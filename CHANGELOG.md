# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-03-28

### Fixed
- JSZip 검증에서 undocumented internal API(`_data.uncompressedSize`) 의존 제거, 엔트리 수 기반 검증으로 교체
- MCP 에러 정제를 regex 기반에서 allowlist 기반으로 교체 — 모든 경로 패턴(UNC, `/opt/`, `/data/` 등) 누락 없이 차단

### Added
- 보안 로직 회귀 테스트 9개 추가 (MAX_RECORDS, span 방어, 제어문자 코드 10, 경로 순회, 에러 정제)
- CHANGELOG.md
- SECURITY.md (취약점 리포팅 절차)

## [1.0.0] - 2026-03-28

### Changed
- **Breaking**: 버전을 1.0.0으로 올림 (API 안정화 선언)

### Security
- PDF: MAX_PAGES(5,000) + 누적 텍스트 크기 100MB 제한으로 OOM 방지
- HWP5: 바이너리에서 읽은 rows/cols를 MAX_ROWS/MAX_COLS로 클램핑 (4.3B 셀 할당 공격 차단)
- HWP5: readRecords MAX_RECORDS(500K) 제한으로 메모리 폭주 방지
- HWP5: findSections fallback 경로에도 MAX_SECTIONS(100) 적용
- HWPX: manifest 경로 검색을 Regex에서 문자열 비교로 교체 (ReDoS 벡터 제거)
- HWPX: 백슬래시 정규화 + Windows 드라이브 문자 경로 순회 차단
- MCP: 에러 메시지에서 파일시스템 경로 정보 제거
- detect: 4바이트 미만 버퍼 명시적 가드
- tsup: CLI/MCP 빌드에 sourcemap 추가

### Fixed
- HWP5: 제어문자 코드 10(각주/미주)을 isExt 범위에 포함 — 각주 포함 문서 파싱 정확도 수정

## [0.2.2] - 2026-03-27

### Security
- colSpan/rowSpan 클램핑 — 악성 병합 값을 그리드 한계로 클램핑
- MCP 서버 safePath 강화 — symlink 해석, 확장자 검증
- 파일 크기 제한 (500MB) 추가

## [0.2.1] - 2026-03-27

### Security
- ZIP bomb 방지 — 100MB 압축 해제 제한, 500 엔트리 제한
- XXE/Billion Laughs 방지 — DOCTYPE 완전 제거
- HWP5 압축 폭탄 방지 — maxOutputLength + 누적 100MB 제한
- 손상 ZIP 경로 순회 차단
- PDF 리소스 정리 (doc.destroy)
- HWP5 섹션 수 제한 (100)

### Changed
- pdfjs-dist를 선택적 peerDependency로 변경

## [0.2.0] - 2026-03-26

### Changed
- 전면 리팩토링: IR(Intermediate Representation) 패턴 도입
- 2-pass 테이블 빌더 구현
- 파서-렌더러 분리 아키텍처

## [0.1.0] - 2026-03-25

### Added
- 최초 릴리스
- HWP 5.x, HWPX, PDF 파싱 지원
- CLI 도구 (kordoc)
- MCP 서버 (kordoc-mcp)
