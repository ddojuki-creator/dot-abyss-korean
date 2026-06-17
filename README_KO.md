# dotabyss Korean Translation Worktree

이 폴더는 AbyssMod가 읽는 번역 CDN 데이터 구조입니다.

## 구조

```text
translations/
├─ manifest/ko_KR.json
├─ names/ko_KR.json
├─ titles/ko_KR.json
├─ descriptions/ko_KR.json
├─ another_name/ko_KR.json
└─ novels/{novelId}/ko_KR.json
```

각 JSON은 일본어 원문을 key로 유지하고, value만 한국어로 번역합니다.

```json
{
    "あー、本当にいいのか？": "아, 정말 괜찮겠어?"
}
```

## 명령

```powershell
npm run manifest
npm run validate:ko
npm run start
```

`npm run manifest`는 `translations/manifest/ko_KR.json`을 갱신합니다. 번역 파일을 수정한 뒤에는 항상 다시 실행해야 합니다.

`npm run validate:ko`는 `ko_KR.json` 파일들이 JSON object 형태인지 검사합니다.

`npm run start`는 로컬 CDN 서버를 `http://localhost:12315`에서 실행합니다.

## AbyssMod 설정

로컬 테스트 시 `BepInEx/config/AbyssMod.cfg`를 이렇게 설정합니다.

```ini
[Translation]
Enabled = true
CDN = http://localhost:12315
Language = ko_KR
```

GitHub에 올려서 배포할 때는 `CDN`을 raw URL의 `translations` 경로로 바꿉니다.

```text
https://raw.githubusercontent.com/{owner}/{repo}/refs/heads/main/translations
```
