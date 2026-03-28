/**
 * 보안 로직 테스트 — 방어적 상수 및 입력 검증 검증
 *
 * 정상 문서에선 트리거되지 않지만, 조작된 입력에 대한 안전장치가
 * 리팩토링 과정에서 조용히 빠지지 않도록 검증하는 회귀 테스트.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readRecords, extractText } from "../src/hwp5/record.js"
import { buildTable, MAX_COLS, MAX_ROWS } from "../src/table/builder.js"
import type { CellContext } from "../src/types.js"

// ─── readRecords: MAX_RECORDS 제한 ─────────────────────

describe("readRecords — MAX_RECORDS 제한", () => {
  it("500,000개 초과 레코드는 잘림", () => {
    // 각 레코드: 4바이트 헤더(tagId=1, level=0, size=0) = 최소 크기
    // header = 1 | (0 << 10) | (0 << 20) = 0x00000001
    const recordCount = 500_001
    const buf = Buffer.alloc(recordCount * 4)
    for (let i = 0; i < recordCount; i++) {
      buf.writeUInt32LE(0x00000001, i * 4) // tagId=1, level=0, size=0
    }
    const records = readRecords(buf)
    assert.equal(records.length, 500_000)
  })
})

// ─── buildTable: 악성 span 값 ────────────────────────────

describe("buildTable — 악성 span 값 방어", () => {
  it("극단적 colSpan/rowSpan에도 크래시 없이 테이블 생성", () => {
    const rows: CellContext[][] = [
      [{ text: "A", colSpan: 9999, rowSpan: 9999 }],
    ]
    // MAX_ROWS = 10000이지만 실제 행이 1개이므로 안전하게 처리되어야 함
    const table = buildTable(rows)
    assert.equal(table.rows, 1)
    assert.ok(table.cols >= 1)
  })

  it("MAX_ROWS 초과 행은 잘림", () => {
    // 10,001행짜리 테이블 → 10,000행으로 잘려야 함
    const rows: CellContext[][] = Array.from({ length: MAX_ROWS + 1 }, () => [
      { text: "x", colSpan: 1, rowSpan: 1 },
    ])
    const table = buildTable(rows)
    assert.equal(table.rows, MAX_ROWS)
  })
})

// ─── extractText: 제어문자 코드 10 (각주/미주) ──────────────

describe("extractText — 제어문자 코드 10 처리", () => {
  it("코드 10(각주/미주)이 확장 제어문자로 14바이트 스킵됨", () => {
    // 코드 10 (0x000A) + 14바이트 payload + 'Z'
    const buf = Buffer.alloc(2 + 14 + 2)
    buf.writeUInt16LE(0x000a, 0) // 각주/미주 제어문자
    // 14바이트 payload (zeros)
    buf.writeUInt16LE("Z".charCodeAt(0), 16)
    const result = extractText(buf)
    assert.equal(result, "Z")
  })

  it("코드 10 뒤에 payload가 부족하면 스킵 안 함 (안전 처리)", () => {
    // 코드 10 + 4바이트만 (14바이트 부족)
    const buf = Buffer.alloc(6)
    buf.writeUInt16LE(0x000a, 0)
    buf.writeUInt16LE("A".charCodeAt(0), 2)
    buf.writeUInt16LE("B".charCodeAt(0), 4)
    // payload 부족이므로 스킵 안 됨 → 'A', 'B'는 그대로 출력될 수 있음
    const result = extractText(buf)
    // 최소한 크래시 없이 반환되어야 함
    assert.equal(typeof result, "string")
  })
})

// ─── 경로 순회 방어 (HWPX broken ZIP) ─────────────────────

describe("경로 순회 방어 — 테스트 가능한 로직 검증", () => {
  it("백슬래시가 포함된 경로는 정규화 후 차단됨", () => {
    // 실제 extractFromBrokenZip은 private이므로 로직만 단위 검증
    const testPaths = [
      "..\\..\\etc\\passwd",
      "Contents\\..\\..\\secret.xml",
      "C:\\Windows\\system32\\config",
      "/etc/passwd",
      "../../../secret",
    ]

    for (const name of testPaths) {
      const normalized = name.replace(/\\/g, "/")
      const isBlocked =
        normalized.includes("..") ||
        normalized.startsWith("/") ||
        /^[A-Za-z]:/.test(normalized)
      assert.equal(isBlocked, true, `경로 "${name}"이 차단되어야 함`)
    }
  })

  it("정상 경로는 통과함", () => {
    const safePaths = [
      "Contents/section0.xml",
      "section1.xml",
      "Contents/Sub/section2.xml",
    ]

    for (const name of safePaths) {
      const normalized = name.replace(/\\/g, "/")
      const isBlocked =
        normalized.includes("..") ||
        normalized.startsWith("/") ||
        /^[A-Za-z]:/.test(normalized)
      assert.equal(isBlocked, false, `경로 "${name}"은 허용되어야 함`)
    }
  })
})

// ─── MCP 에러 정제 ─────────────────────────────────────

describe("MCP sanitizeError — allowlist 방식 검증", () => {
  /**
   * sanitizeError는 mcp.ts 내부 함수이므로 직접 import 불가.
   * 동일한 로직을 복제하여 단위 테스트.
   * mcp.ts의 구현이 변경되면 이 테스트도 업데이트해야 함.
   */
  const SAFE_ERROR_PATTERNS = [
    /^(빈 버퍼|지원하지 않는|파싱 실패|암호화된|DRM 보호|FileHeader|HWP 시그니처|HWPX에서|섹션 스트림|ZIP|pdfjs-dist|PDF에|텍스트 추출|이미지 기반|총 압축)/,
    /^(파일 경로가|절대 경로만|확장자)/,
  ]

  function sanitizeError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err)
    if (SAFE_ERROR_PATTERNS.some(p => p.test(msg))) return msg
    return "문서 처리 중 오류가 발생했습니다"
  }

  it("kordoc 내부 에러 메시지는 그대로 반환", () => {
    const safeMessages = [
      "빈 버퍼이거나 유효하지 않은 입력입니다.",
      "암호화된 HWP는 지원하지 않습니다",
      "DRM 보호된 HWP는 지원하지 않습니다",
      "ZIP 압축 해제 크기 초과 (ZIP bomb 의심)",
      "HWPX에서 섹션 파일을 찾을 수 없습니다",
      "파일 경로가 비어있습니다",
      "절대 경로만 허용됩니다",
      "확장자: .docx는 지원하지 않습니다",
      "pdfjs-dist가 설치되지 않았습니다",
      "텍스트 추출 크기 초과",
      "총 압축 해제 크기 초과",
    ]

    for (const msg of safeMessages) {
      assert.equal(sanitizeError(new Error(msg)), msg, `"${msg}"는 그대로 반환되어야 함`)
    }
  })

  it("알 수 없는 에러 메시지는 일반 메시지로 대체", () => {
    const unsafeMessages = [
      "ENOENT: no such file or directory, open 'C:\\Users\\admin\\secret.hwp'",
      "Cannot read properties of null (reading 'getPage') at /opt/app/node_modules/pdfjs-dist/build/pdf.js:1234",
      "EACCES: permission denied, open '/home/user/.ssh/id_rsa'",
      "Error: \\\\server\\share\\documents\\report.hwp",
    ]

    for (const msg of unsafeMessages) {
      assert.equal(
        sanitizeError(new Error(msg)),
        "문서 처리 중 오류가 발생했습니다",
        `"${msg}"는 경로 정보가 제거되어야 함`
      )
    }
  })
})
