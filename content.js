// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log("Content script received message:", request);
    
    if (request.action === "getPageHTML") {
        try {
            // Use the utility function to get simplified HTML
            const simplifiedHtml = window.getSimplifiedPageHtml();
            
            console.log("Sending HTML response");
            sendResponse({html: simplifiedHtml});
        } catch (error) {
            console.error("Error getting HTML:", error);
            sendResponse({error: error.message});
        }
    }
    return true; // Keep the message channel open for async response
});

// Log when the content script is loaded
console.log("Content script loaded"); 