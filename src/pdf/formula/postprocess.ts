/**
 * LaTeX 후처리 — Pix2Text `latex_ocr.py` 의 post_process 간소화
 *
 * 1) 후행 whitespace command 제거 (\, \: \; \! \quad \qquad \enspace \thinspace \ )
 * 2) 연속 공백 → 1개
 * 3) 빈 그룹 반복 제거 (^{} _{} \hat{} \bar{} \vec{} 등)
 */

const TRAILING_WHITESPACE_CMDS = [
  "\\,",
  "\\:",
  "\\;",
  "\\!",
  "\\ ",
  "\\quad",
  "\\qquad",
  "\\enspace",
  "\\thinspace",
] as const

export function postProcessLatex(latex: string): string {
  let s = stripTrailingWhitespace(latex)
  s = collapseSpaces(s)
  for (let i = 0; i < 10; i++) {
    const next = stripEmptyGroups(s)
    if (next === s) break
    s = next
  }
  return s.trim()
}

export function stripTrailingWhitespace(s: string): string {
  let t = s
  // 바깥 loop: 한 번 제거 후 다시 체크 (중첩 "\\, \\quad" 같은 경우)
  for (;;) {
    const trimmed = t.replace(/[\s]+$/, "")
    let changed = false
    for (const p of TRAILING_WHITESPACE_CMDS) {
      if (trimmed.endsWith(p)) {
        t = trimmed.slice(0, trimmed.length - p.length)
        changed = true
        break
      }
    }
    if (!changed) return trimmed
  }
}

export function collapseSpaces(s: string): string {
  let out = ""
  let prevSpace = false
  for (const c of s) {
    if (/\s/.test(c)) {
      if (!prevSpace) {
        out += " "
        prevSpace = true
      }
    } else {
      out += c
      prevSpace = false
    }
  }
  return out
}

/**
 * 빈 그룹 `{}` 또는 `{\s+}` 를 찾아 선행하는 `^`, `_`, 또는 `\cmd` 와 함께 제거.
 */
export function stripEmptyGroups(s: string): string {
  let out = ""
  let i = 0
  const bytes = s
  while (i < bytes.length) {
    const ch = bytes[i]
    if (ch === "{") {
      // 빈 { \s* } 스캔
      let j = i + 1
      while (j < bytes.length && /\s/.test(bytes[j])) j++
      if (j < bytes.length && bytes[j] === "}") {
        // 앞쪽 공백 제거
        while (out.endsWith(" ") || out.endsWith("\t")) {
          out = out.slice(0, -1)
        }
        if (out.endsWith("^") || out.endsWith("_")) {
          out = out.slice(0, -1)
        } else {
          // \cmd 형태인지 탐색
          let k = out.length
          while (k > 0 && /[A-Za-z]/.test(out[k - 1])) k--
          if (k > 0 && out[k - 1] === "\\" && k < out.length) {
            out = out.slice(0, k - 1)
          }
          // 아니면 아무것도 안 함 — 빈 {} 만 제거
        }
        i = j + 1
        continue
      }
    }
    out += ch
    i++
  }
  return out
}
