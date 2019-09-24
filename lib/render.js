'use strict';

const Inky = require('inky').Inky;
const Juice = require('juice');
const Hoek = require('@hapi/hoek');

module.exports = (htmlFile, cssFile, options = {
    inky: {enabled: true},
    juice: {linkCss: false, webResources: {images: false}}
}) => {
    return new Promise((resolve, reject) => {
        Hoek.assert(htmlFile || htmlFile === '', new Error('HTML file is required!'));

        let convertedHtml;
        if (options.inky.enabled) {
            const inky = new Inky(options.inky);
            convertedHtml = inky.releaseTheKraken(htmlFile);
        }

        if (options.juice.linkCss) {
            Juice.juiceResources(options.inky.enabled ? convertedHtml : htmlFile, options.juice, (err, htmlResult) => {
                if (err) {
                    return reject(err);
                }

                return resolve(htmlResult);
            });
        } else {
            return resolve(Juice.inlineContent(options.inky.enabled ? convertedHtml : htmlFile, cssFile || '', options.juice))
        }
    })
};
