'use strict';
var vw = require('../')
var assert = require('assert')
vw.readModel(__dirname + "/readable_model.txt", (model) => {
    var out = vw.predict(model, {
        namespaces: [{
            name: 'f',
            features: [{
                name: 'a',
                value: 1
            }, {
                name: 'b',
                value: 1
            }, {
                name: 'c',
                value: 1
            }, {
                name: 'odd=-1',
                value: 1
            }]
        }]
    });
    assert.equal(out[0], -1.0142035484313965);
});