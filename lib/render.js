const Inky = require('inky').Inky;
const Juice = require('juice');

module.exports = (htmlFile, cssFile, options = { inky: { enabled: true }, juice: { linkCss: false } }) => {
    let convertedHtml;
    if (options.inky.enabled) {
        const inky = new Inky(options.inky);
        convertedHtml = inky.releaseTheKraken(htmlFile);
    }

    if (options.juice.linkCss) {
        return new Promise((resolve, reject) => {
            Juice.juiceResources(options.inky.enabled ? convertedHtml : htmlFile, options.juice, (err, htmlResult) => {
                if (err) {
                    return reject(err);
                }

                return resolve(htmlResult);
            });
        });
    } else {
        return Promise.resolve(Juice.inlineContent(options.inky.enabled ? convertedHtml : htmlFile, cssFile, options.juice))
    }
}