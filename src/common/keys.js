// Fill Mode — 물리 키(e.code) 기반 키 식별
// 한글 등 IME 상태에서는 e.key가 'ㅋ'처럼 조합 문자로 들어와 단축키가 어긋난다.
// 자판 언어와 무관하게 같은 물리 키로 동작하도록 e.code를 문자로 정규화한다.

const FM_CODE_TO_CHAR = {
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
};

function fmKeyFromEvent(e) {
  const code = e.code;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (FM_CODE_TO_CHAR[code]) return FM_CODE_TO_CHAR[code];
  return e.key; // 화살표 등 나머지는 e.key 그대로
}
