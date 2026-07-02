// Fill Mode — background service worker
// 전역 커맨드 단축키를 활성 탭의 content script로 라우팅한다.

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'command', command });
  } catch {
    // content script가 아직 주입되지 않은 탭(chrome:// 등)은 무시
  }
});
