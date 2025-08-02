// Function to simplify HTML by removing scripts and styles
window.simplifyHtml = function(html) {
    // Create a temporary div to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Remove HTML comments using regex (including multiline comments)
    const commentRegex = /<!--[\s\S]*?-->/g;
    let processedHtml = tempDiv.innerHTML;
    while (processedHtml.match(commentRegex)) {
        processedHtml = processedHtml.replace(commentRegex, '');
    }
    tempDiv.innerHTML = processedHtml;

    // Remove all script elements
    const scripts = tempDiv.getElementsByTagName('script');
    while (scripts.length > 0) {
        scripts[0].parentNode.removeChild(scripts[0]);
    }

    // Remove all iframe elements
    const iframes = tempDiv.getElementsByTagName('iframe');
    while (iframes.length > 0) {
        iframes[0].parentNode.removeChild(iframes[0]);
    }

    // Remove all noscript elements
    const noscripts = tempDiv.getElementsByTagName('noscript');
    while (noscripts.length > 0) {
        noscripts[0].parentNode.removeChild(noscripts[0]);
    }

    // Remove header elements
    const headers = tempDiv.getElementsByTagName('header');
    while (headers.length > 0) {
        headers[0].parentNode.removeChild(headers[0]);
    }

    // Remove footer elements
    const footers = tempDiv.getElementsByTagName('footer');
    while (footers.length > 0) {
        footers[0].parentNode.removeChild(footers[0]);
    }

    // Remove meta elements
    const metas = tempDiv.getElementsByTagName('meta');
    while (metas.length > 0) {
        metas[0].parentNode.removeChild(metas[0]);
    }

    // Remove all link elements
    const links = tempDiv.getElementsByTagName('link');
    while (links.length > 0) {
        links[0].parentNode.removeChild(links[0]);
    }

    // Remove all style elements
    const styles = tempDiv.getElementsByTagName('style');
    while (styles.length > 0) {
        styles[0].parentNode.removeChild(styles[0]);
    }

    // Remove blank lines
    let result = tempDiv.innerHTML;
    result = result.replace(/^\s*[\r\n]/gm, ''); // Remove empty lines
    result = result.replace(/\n\s*\n/g, '\n');   // Replace multiple newlines with single newline
    result = result.trim();                      // Remove leading/trailing whitespace

    return result;
};

// Function to get simplified page HTML
window.getSimplifiedPageHtml = function() {
    try {
        // Get the current page's HTML
        const html = document.documentElement.outerHTML;
        
        // Create a complete HTML document
        const completeHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${document.title}</title>
</head>
<body>
    ${document.body.innerHTML}
</body>
</html>`;

        // Simplify the HTML
        return window.simplifyHtml(completeHtml);
    } catch (error) {
        console.error("Error getting simplified HTML:", error);
        return {error: error.message};
    }
}; 