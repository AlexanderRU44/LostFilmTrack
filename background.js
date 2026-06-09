// Обработчик сообщений из popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'closePopup') {
        // Закрываем текущее popup окно
        chrome.action.getUserSettings().then(() => {
            // Просто закрываем - нет прямого API, но window.close() в popup сработает
        });
    }
    return true;
});