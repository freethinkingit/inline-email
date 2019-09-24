'use strict';

const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const Render = require('../../lib/render')

const expect = Code.expect;
const lab = exports.lab = Lab.script();

lab.experiment('render', () => {
    lab.test('with no args throws error requiring HTML files', () => {
        return Render()
            .catch((error) => {
                expect(error.message).to.equal('HTML file is required!');
            });
    });

    lab.test('with blank HTML files returns nothing', () => {
        return Render('')
        .then((htmlResult) => {
            expect(htmlResult).to.equal('');
        })
    });

    lab.test('with no args throws error requiring HTML files', () => {
        return Render()
            .catch((error) => {
                expect(error.message).to.equal('HTML file is required!');
            });
    });

    lab.test('convert inky tags to html', () => {
        return Render('<row>thing</row>', null, {inky: {enabled: true}, juice: {}})
        .then((htmlResult) => {
            expect(htmlResult).to.equal('<table class=\"row\"><tbody><tr>thing</tr></tbody></table>');
        })
    });
});
