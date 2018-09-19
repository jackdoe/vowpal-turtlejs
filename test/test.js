'use strict';
var vw = require('../')
var assert = require('assert')
vw.readModelFromFile(__dirname + "/readable_model_ab.txt", (model) => {
    var out = vw.predict(model, {
        namespaces: [
            {
                name: 'a',
                features: [
                    {
                        name: 'x',
                        value: 1
                    },
                    {
                        name: 'z',
                        value: 1
                    }                    
                ]
            },
            {
                name: 'b',
                features: [
                    {
                        name: 'x1',
                        value: 1
                    },
                    {
                        name: 'z1',
                        value: 1
                    }                    
                ]
            }            
        ]
    }, vw.identity);
    assert.equal(out[0], -0.06566070020198822);
});
