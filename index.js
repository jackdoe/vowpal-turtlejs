'use strict';

var readline = undefined;
const intercept = 11650396;
const FNV_prime = 16777619;
/*
 * JS Implementation of MurmurHash3 (r136) (as of May 20, 2011)
 * @author <a href="mailto:gary.court@gmail.com">Gary Court</a>
 * @author <a href="mailto:aappleby@gmail.com">Austin Appleby</a>
 */
var murmurhash3_32_gc = function murmurhash3_32_gc(key, seed) {
    var remainder,
        bytes,
        h1,
        h1b,
        c1,
        c1b,
        c2,
        c2b,
        k1,
        i;

    remainder = key.length & 3; // key.length % 4
    bytes = key.length - remainder;
    h1 = seed;
    c1 = 0xcc9e2d51;
    c2 = 0x1b873593;
    i = 0;

    while (i < bytes) {
        k1 = ((key.charCodeAt(i) & 0xff)) | ((key.charCodeAt(++i) & 0xff) << 8) | ((key.charCodeAt(++i) & 0xff) << 16) | ((key.charCodeAt(++i) & 0xff) << 24);
        ++i;

        k1 = ((((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16))) & 0xffffffff;
        k1 = (k1 << 15) | (k1 >>> 17);
        k1 = ((((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16))) & 0xffffffff;

        h1 ^= k1;
        h1 = (h1 << 13) | (h1 >>> 19);
        h1b = ((((h1 & 0xffff) * 5) + ((((h1 >>> 16) * 5) & 0xffff) << 16))) & 0xffffffff;
        h1 = (((h1b & 0xffff) + 0x6b64) + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16));
    }

    k1 = 0;

    switch (remainder) {
        case 3:
            k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
        case 2:
            k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
        case 1:
            k1 ^= (key.charCodeAt(i) & 0xff);

            k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
            k1 = (k1 << 15) | (k1 >>> 17);
            k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
            h1 ^= k1;
    }

    h1 ^= key.length;

    h1 ^= h1 >>> 16;
    h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
    h1 ^= h1 >>> 13;
    h1 = ((((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16))) & 0xffffffff;
    h1 ^= h1 >>> 16;

    return h1 >>> 0;
}
var fs = undefined
/**
 * it does not support quadratic/cubic interractions, ngrams/skips, linking functions rather than identity
 * it basically only supports(for now) cat data | vw --readable_model out.txt [-oaa]
 * @param {String} file - vw --readable_file output
 * @param {Function} cb - callback once the file is loaded, takes the loaded model as only argument
 */
var readModelFromFile = function readModelFromFile(file, cb) {
    if (!fs)
        fs = require('fs');

    const instream = fs.createReadStream(file)
    return readModelFromStream(instream, cb)
}

const logistic = (o) => (1. / (1. + Math.exp(-o)))
const identity = (o) => o

var readModelFromString = function readModelFromString(buf, cb) {
    let inHeader = true;
    let hash = [];
    let oaa = 1;
    let bits = 0;
    let quadratic = undefined
    let lines = buf.split("\n");
    for (let line of lines) {
        if (inHeader) {
            if (line.startsWith("bits:")) {
                bits = parseInt(line.split(":")[1])
                hash = new Float32Array(1 << bits);
            }
            if (line.startsWith('options:')) {
                let splitted = line.split(':');
                let options = splitted[1].split(" ");
                for (let i = 0; i < options.length; i += 2) {
                    if (options[i] == '--oaa') {
                        oaa = parseInt(options[i + 1])
                    }
                }
            }
            if (line.startsWith("options:")) {
                let opts = line
                    .split(":")[1]
                    .trim()
                    .split(" ")

                for (let i = 0; i < opts.length; i += 2) {
                    let key = opts[i]
                    let value = opts[i + 1]
                    if (key === "--quadratic") {
                        if (!quadratic)
                            quadratic = {};

                        let startsWith = quadratic[value.charAt(0)] || (quadratic[value.charAt(0)] = [])
                        startsWith.push(value.charAt(1))
                    }
                }
            }
            if (line == ":0") {
                inHeader = false;
            }
        } else {
            var splitted = line.split(":")
            hash[parseInt(splitted[0])] = parseFloat(splitted[1])
        }
    }

    let multiClassBits = 0;
    let ml = oaa;
    while (ml > 0) {
        multiClassBits++;
        ml >>= 1;
    }

    cb({
        quadratic: quadratic,
        hash: hash,
        link: logistic,
        oaa: oaa,
        multiclassBits: multiClassBits,
        mask: (1 << bits) - 1
    })
}

var readModelFromStream = function readModelFromStream(instream, cb) {
    var buf = ''
    instream.on('data', function (raw) {
        // XXX: parse line by line
        buf += raw
    });

    instream.on('end', function (line) {
        return readModelFromString(buf, cb)
    });
}

var getBucket = function (multiClassBits, featureHash, klass, mask) {
    return ((featureHash << multiClassBits) | klass) & mask;
}

/**
 * makes a prediction from a request and a model
 * the request is { namespaces: [{name: 'some_namespace', features: [{name: 'some_feature', value: 1}]}]}
 * it also mutates the request computing the hashes so they can be reused
 * @example
 * var vw = require('vowpal-turtle')
 * vw.readModel('readable_model.txt', (model) => {
 *     var prediction = vw.predict(model, {
 *         namespaces: [{
 *             name: 'something',
 *             features: [{
 *                 name: 'a',
 *                 value: 1
 *             }, {
 *                 name: 'b',
 *                 value: 1
 *             }, {
 *                 name: 'c',
 *                 value: 1
 *             }]
 *         }]
 *     });
 *     console.log(prediction)
 * });
 *
 * @param {Object} model - mode loaded from @see readModel
 * @param {Object} request - {.namespaces - array of namespaces, each of which has array of features}
 * @param {Function} link - link function, by default vw.logistic
 * @returns {Float32Array} prediction, one prediction per class (depending on oaa, by default 1)
 */
var predict = function predict(model, request, link) {
    link = link || logistic
    var out = new Float32Array(model.oaa);
    for (let ns of request.namespaces) {
        let nsHash = ns.compudedHash
            ? ns.hash
            : murmurhash3_32_gc(ns.name, 0);
        ns.compudedHash = true;
        ns.hash = nsHash;

        for (let f of ns.features) {
            let featureHash = f.computedHash
                ? f.hash
                : murmurhash3_32_gc(f.name, nsHash);
            f.computedHash = true;
            f.hash = featureHash;

            for (let klass = 0; klass < model.oaa; klass++) {
                let bucket = getBucket(this.multiClassBits, featureHash, klass, model.mask)
                out[klass] += f.value * model.hash[bucket];
            }
        }
    }

    if (model.quadratic) {
        let perChar = {}
        for (let ns of request.namespaces) {
            let x = perChar[
                ns
                    .name
                    .charAt(0)
            ] || (perChar[
                ns
                    .name
                    .charAt(0)
            ] = [])
            x.push(ns)
        }

        for (let nsA of request.namespaces) {
            let nasInterractions = model.quadratic[
                nsA
                    .name
                    .charAt(0)
            ] || [];
            for (let interraction of nasInterractions) {
                let startsWith = perChar[interraction]
                if (startsWith) {
                    for (let nsB of startsWith) {
                        for (let featureA of nsA.features) {
                            for (let featureB of nsB.features) {
                                let fnv = ((featureA.hash * FNV_prime) ^ featureB.hash)
                                for (let klass = 0; klass < model.oaa; klass++) {
                                    let bucket = getBucket(this.multiClassBits, fnv, klass, model.mask)
                                    out[klass] += featureA.value * featureB.value * model.hash[bucket];
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    for (let klass = 0; klass < model.oaa; klass++) {
        let bucket = getBucket(this.multiClassBits, intercept, klass, model.mask)
        out[klass] += model.hash[bucket];

        out[klass] = link(out[klass])
    }

    return out;
}

if (typeof window !== 'undefined') {
    window.vw = {
        readModelFromStream: readModelFromStream,
        readModelFromFile: readModelFromFile,
        readModelFromString: readModelFromString,
        logistic: logistic,
        identity: identity,
        predict: predict
    }
}
if (typeof module !== 'undefined') {
    module.exports = {
        readModelFromStream: readModelFromStream,
        readModelFromFile: readModelFromFile,
        readModelFromString: readModelFromString,
        logistic: logistic,
        identity: identity,
        predict: predict
    };
}
