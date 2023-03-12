"use strict";

import {fileList} from "../../file_list";




// console.log(path.join(basePath, "/src/config.js"));
import {
    background,
    baseUri,
    buildDir,
    debugLogs,
    description,
    emptyLayerName,
    extraAttributes,
    extraMetadata,
    forcedCombinations,
    format,
    hashImages,
    incompatible,

    layerConfigurations,
    layersDir,
    outputJPEG,
    rarityDelimiter,
    shuffleLayerConfigurations,
    startIndex,
    traitValueOverrides,
    uniqueDnaTorrance,
    useRootTraitType,
} from "../../config";

// let metadataList = [];
let attributesList = [];

// when generating a random background used to add to DNA
let generatedBackground;

let dnaList = new Set(); // internal+external: list of all files. used for regeneration etc
let uniqueDNAList = new Set(); // internal: post-filtered dna set for bypassDNA etc.
const DNA_DELIMITER = "*";

const zflag = /(z-?\d*,)/;


const cleanDna = (_str) => {
    var dna = _str.split(":").shift();
    return dna;
};


const parseZIndex = (str) => {
    const z = zflag.exec(str);
    return z ? parseInt(z[0].match(/-?\d+/)[0]) : null;
};


/**
 * Checks the override object for trait overrides
 * @param {String} trait The default trait value from the path-name
 * @returns String trait of either overridden value of raw default.
 */
const processTraitOverrides = (trait) => {
    return traitValueOverrides[trait] ? traitValueOverrides[trait] : trait;
};


const genColor = (prng) => {
    let hue = Math.floor(prng.random() * 360);
    let pastel = `hsl(${hue}, 100%, ${background.brightness})`;
    // store the background color in the dna
    generatedBackground = pastel; //TODO: storing in a global var is brittle. could be improved.
    return pastel;
};

const drawBackground = (canvasContext, background) => {
    canvasContext.fillStyle = background.HSL ?? genColor();

    canvasContext.fillRect(0, 0, format.width, format.height);
};

const addMetadata = (_dna, _edition, _prefixData) => {
    let dateTime = Date.now();
    const { _prefix, _offset, _imageHash } = _prefixData;

    const combinedAttrs = [...attributesList, ...extraAttributes()];
    const cleanedAttrs = combinedAttrs.reduce((acc, current) => {
        const x = acc.find((item) => item.trait_type === current.trait_type);
        if (!x) {
            return acc.concat([current]);
        } else {
            return acc;
        }
    }, []);

    let tempMetadata = {
        name: `${_prefix ? _prefix + " " : ""}#${_edition - _offset}`,
        description: description,
        image: `${baseUri}/${_edition}${outputJPEG ? ".jpg" : ".png"}`,
        ...(hashImages === true && { imageHash: _imageHash }),
        edition: _edition,
        date: dateTime,
        ...extraMetadata,
        attributes: cleanedAttrs,
        compiler: "HashLips Art Engine - NFTChef fork",
    };
    metadataList.push(tempMetadata);
    attributesList = [];
    return tempMetadata;
};

const addAttributes = (_element) => {
    let selectedElement = _element.layer;
    const layerAttributes = {
        trait_type: _element.layer.trait,
        value: selectedElement.traitValue,
        ...(_element.layer.display_type !== undefined && {
            display_type: _element.layer.display_type,
        }),
    };
    if (
        attributesList.some(
            (attr) => attr.trait_type === layerAttributes.trait_type
        )
    )
        return;
    attributesList.push(layerAttributes);
};

const loadLayerImg = async (_layer) => {
    return new Promise(async (resolve) => {
        // selected elements is an array.
        const image = await loadImage(`${_layer.path}`).catch((err) =>
            console.log(`failed to load ${_layer.path}`, err)
        );
        resolve({ layer: _layer, loadedImage: image });
    });
};

const drawElement = (_renderObject) => {
    const layerCanvas = createCanvas(format.width, format.height);
    const layerctx = layerCanvas.getContext("2d");
    layerctx.imageSmoothingEnabled = format.smoothing;

    layerctx.drawImage(
        _renderObject.loadedImage,
        0,
        0,
        format.width,
        format.height
    );

    addAttributes(_renderObject);
    return layerCanvas;
};

const constructLayerToDna = (_dna = [], _layers = []) => {
    const dna = _dna.split(DNA_DELIMITER);
    let mappedDnaToLayers = _layers.map((layer, index) => {
        let selectedElements = [];
        const layerImages = dna.filter(
            (element) => element.split(".")[0] == layer.id
        );
        layerImages.forEach((img) => {
            const indexAddress = cleanDna(img);

            //

            const indices = indexAddress.toString().split(".");
            // const firstAddress = indices.shift();
            const lastAddress = indices.pop(); // 1
            // recursively go through each index to get the nested item
            let parentElement = indices.reduce((r, nestedIndex) => {
                if (!r[nestedIndex]) {
                    throw new Error("wtf");
                }
                return r[nestedIndex].elements;
            }, _layers); //returns string, need to return

            selectedElements.push(parentElement[lastAddress]);
        });
        // If there is more than one item whose root address indicies match the layer ID,
        // continue to loop through them an return an array of selectedElements

        return {
            name: layer.name,
            blendmode: layer.blendmode,
            opacity: layer.opacity,
            selectedElements: selectedElements,
            ...(layer.display_type !== undefined && {
                display_type: layer.display_type,
            }),
        };
    });
    return mappedDnaToLayers;
};

/**
 * In some cases a DNA string may contain optional query parameters for options
 * such as bypassing the DNA isUnique check, this function filters out those
 * items without modifying the stored DNA.
 *
 * @param {String} _dna New DNA string
 * @returns new DNA string with any items that should be filtered, removed.
 */
const filterDNAOptions = (_dna) => {
    const filteredDNA = _dna.split(DNA_DELIMITER).filter((element) => {
        const query = /(\?.*$)/;
        const querystring = query.exec(element);
        if (!querystring) {
            return true;
        }
        // convert the items in the query string to an object
        const options = querystring[1].split("&").reduce((r, setting) => {
            const keyPairs = setting.split("=");
            //   construct the object →       {bypassDNA: bool}
            return { ...r, [keyPairs[0].replace("?", "")]: keyPairs[1] };
        }, []);
        // currently, there is only support for the bypassDNA option,
        // when bypassDNA is true, return false to omit from .filter
        return options.bypassDNA === "true" ? false : true;
    });

    return filteredDNA.join(DNA_DELIMITER);
};

/**
 * Cleaning function for DNA strings. When DNA strings include an option, it
 * is added to the filename with a ?setting=value query string. It needs to be
 * removed to properly access the file name before Drawing.
 *
 * @param {String} _dna The entire newDNA string
 * @returns Cleaned DNA string without querystring parameters.
 */
const removeQueryStrings = (_dna) => {
    const query = /(\?.*$)/;
    return _dna.replace(query, "");
};

/**
 * determine if the sanitized/filtered DNA string is unique or not by comparing
 * it to the set of all previously generated permutations.
 *
 * @param {String} _dna string
 * @returns isUnique is true if uniqueDNAList does NOT contain a match,
 *  false if uniqueDANList.has() is true
 */
const isDnaUnique = (_dna = []) => {
    const filtered = filterDNAOptions(_dna);
    return !uniqueDNAList.has(filterDNAOptions(_dna));
};

// expecting to return an array of strings for each _layer_ that is picked,
// should be a flattened list of all things that are picked randomly AND required
/**
 *
 * @param {Object} layer The main layer, defined in config.layerConfigurations
 * @param {Array} dnaSequence Strings of layer to object mappings to nesting structure
 * @param {Number*} parentId nested parentID, used during recursive calls for sublayers
 * @param {Array*} incompatibleDNA Used to store incompatible layer names while building DNA
 * @param {Array*} forcedDNA Used to store forced layer selection combinations names while building DNA
 * @param {Int} zIndex Used in the dna string to define a layers stacking order
 * @param {Object} prng Random number generator for public works
 *  from the top down
 * @returns Array DNA sequence
 */
function pickRandomElement(
    layer,
    dnaSequence,
    parentId,
    incompatibleDNA,
    forcedDNA,
    bypassDNA,
    zIndex,
    prng
) {
    let totalWeight = 0;
    // Does this layer include a forcedDNA item? ya? just return it.
    const forcedPick = layer.elements.find((element) =>
        forcedDNA.includes(element.name)
    );
    if (forcedPick) {
        debugLogs
            ? console.log(`Force picking ${forcedPick.name}/n`)
            : null;
        if (forcedPick.sublayer) {
            return dnaSequence.concat(
                pickRandomElement(
                    forcedPick,
                    dnaSequence,
                    `${parentId}.${forcedPick.id}`,
                    incompatibleDNA,
                    forcedDNA,
                    bypassDNA,
                    zIndex,prng
                )
            );
        }
        let dnaString = `${parentId}.${forcedPick.id}:${forcedPick.zindex}${forcedPick.filename}${bypassDNA}`;
        return dnaSequence.push(dnaString);
    }

    if (incompatibleDNA.includes(layer.name) && layer.sublayer) {
        debugLogs
            ? console.log(
                `Skipping incompatible sublayer directory, ${layer.name}`,
                layer.name
            )
            : null;
        return dnaSequence;
    }

    const compatibleLayers = layer.elements.filter(
        (layer) => !incompatibleDNA.includes(layer.name)
    );
    if (compatibleLayers.length === 0) {
        debugLogs
            ? console.log(

                "No compatible layers in the directory, skipping",
                layer.name

            )
            : null;
        return dnaSequence;
    }

    compatibleLayers.forEach((element) => {
        // If there is no weight, it's required, always include it
        // If directory has %, that is % chance to enter the dir
        if (element.weight == "required" && !element.sublayer) {
            let dnaString = `${parentId}.${element.id}:${element.zindex}${element.filename}${bypassDNA}`;
            dnaSequence.unshift(dnaString);
            return;
        }
        // when the current directory is a required folder
        // and the element in the loop is another folder
        if (element.weight == "required" && element.sublayer) {
            const next = pickRandomElement(
                element,
                dnaSequence,
                `${parentId}.${element.id}`,
                incompatibleDNA,
                forcedDNA,
                bypassDNA,
                zIndex,prng
            );
        }
        if (element.weight !== "required") {
            totalWeight += element.weight;
        }
    });
    // if the entire directory should be ignored…

    // number between 0 - totalWeight
    const currentLayers = compatibleLayers.filter((l) => l.weight !== "required");

    let random = Math.floor(prng.random() * totalWeight);

    for (var i = 0; i < currentLayers.length; i++) {
        // subtract the current weight from the random weight until we reach a sub zero value.
        // Check if the picked image is in the incompatible list
        random -= currentLayers[i].weight;

        // e.g., directory, or, all files within a directory
        if (random < 0) {
            // Check for incompatible layer configurations and only add incompatibilities IF
            // chosing _this_ layer.
            if (incompatible[currentLayers[i].name]) {
                debugLogs
                    ? console.log(
                        `Adding the following to incompatible list`,
                        ...incompatible[currentLayers[i].name]
                    )
                    : null;
                incompatibleDNA.push(...incompatible[currentLayers[i].name]);
            }
            // Similar to incompaticle, check for forced combos
            if (forcedCombinations[currentLayers[i].name]) {
                debugLogs
                    ? console.log(

                        `\nSetting up the folling forced combinations for ${currentLayers[i].name}: `,
                        ...forcedCombinations[currentLayers[i].name]

                    )
                    : null;
                forcedDNA.push(...forcedCombinations[currentLayers[i].name]);
            }
            // if there's a sublayer, we need to concat the sublayers parent ID to the DNA srting
            // and recursively pick nested required and random elements
            if (currentLayers[i].sublayer) {
                return dnaSequence.concat(
                    pickRandomElement(
                        currentLayers[i],
                        dnaSequence,
                        `${parentId}.${currentLayers[i].id}`,
                        incompatibleDNA,
                        forcedDNA,
                        bypassDNA,
                        zIndex,prng
                    )
                );
            }

            // none/empty layer handler
            if (currentLayers[i].name === emptyLayerName) {
                return dnaSequence;
            }
            let dnaString = `${parentId}.${currentLayers[i].id}:${currentLayers[i].zindex}${currentLayers[i].filename}${bypassDNA}`;
            return dnaSequence.push(dnaString);
        }
    }
}

/**
 * given the nesting structure is complicated and messy, the most reliable way to sort
 * is based on the number of nested indecies.
 * This sorts layers stacking the most deeply nested grandchildren above their
 * immediate ancestors
 * @param {[String]} layers array of dna string sequences
 */
const sortLayers = (layers) => {
    const nestedsort = layers.sort((a, b) => {
        const addressA = a.split(":")[0];
        const addressB = b.split(":")[0];
        return addressA.length - addressB.length;
    });

    let stack = { front: [], normal: [], end: [] };
    stack = nestedsort.reduce((acc, layer) => {
        const zindex = parseZIndex(layer);
        if (!zindex)
            return { ...acc, normal: [...(acc.normal ? acc.normal : []), layer] };
        // move negative z into `front`
        if (zindex < 0)
            return { ...acc, front: [...(acc.front ? acc.front : []), layer] };
        // move positive z into `end`
        if (zindex > 0)
            return { ...acc, end: [...(acc.end ? acc.end : []), layer] };
        // make sure front and end are sorted
        // contat everything back to an ordered array
    }, stack);

    // sort the normal array
    stack.normal.sort();

    return sortByZ(stack.front).concat(stack.normal).concat(sortByZ(stack.end));
};

/** File String sort by zFlag */
function sortByZ(dnastrings) {
    return dnastrings.sort((a, b) => {
        const indexA = parseZIndex(a);
        const indexB = parseZIndex(b);
        return indexA - indexB;
    });
}

/**
 * Sorting by index based on the layer.z property
 * @param {Array } layers selected Image layer objects array
 */
function sortZIndex(layers) {
    return layers.sort((a, b) => {
        const indexA = parseZIndex(a.zindex);
        const indexB = parseZIndex(b.zindex);
        return indexA - indexB;
    });
}

const createDna = (_layers,prng) => {
    let dnaSequence = [];
    let incompatibleDNA = [];
    let forcedDNA = [];

    _layers.forEach((layer) => {
        const layerSequence = [];
        pickRandomElement(
            layer,
            layerSequence,
            layer.id,
            incompatibleDNA,
            forcedDNA,
            layer.bypassDNA ? "?bypassDNA=true" : "",
            layer.zindex ? layer.zIndex : "",
            prng
        );
        const sortedLayers = sortLayers(layerSequence);
        dnaSequence = [...dnaSequence, [sortedLayers]];
    });
    const zSortDNA = sortByZ(dnaSequence.flat(2));
    const dnaStrand = zSortDNA.join(DNA_DELIMITER);

    return dnaStrand;
};


// const saveMetaDataSingleFile = (_editionCount, _buildDir) => {
//     let metadata = metadataList.find((meta) => meta.edition == _editionCount);
//     debugLogs
//         ? console.log(
//             `Writing metadata for ${_editionCount}: ${JSON.stringify(metadata)}`
//         )
//         : null;
//     fs.writeFileSync(
//         `${_buildDir}/json/${_editionCount}.json`,
//         JSON.stringify(metadata, null, 2)
//     );
// };

function shuffle(array,prng) {
    let currentIndex = array.length,
        randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(prng.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex],
            array[currentIndex],
        ];
    }
    return array;
}

/**
 * Paints the given renderOjects to the main canvas context.
 *
 * @param {Array} renderObjectArray Array of render elements to draw to canvas
 * @param {Object} layerData data passed from the current iteration of the loop or configured dna-set
 *
 */
const paintLayers = (canvasContext, renderObjectArray, layerData) => {
    debugLogs ? console.log("\nClearing canvas") : null;
    canvasContext.clearRect(0, 0, format.width, format.height);

    const { abstractedIndexes, _background } = layerData;

    renderObjectArray.forEach((renderObject) => {
        // one main canvas
        // each render Object should be a solo canvas
        // append them all to main canbas
        canvasContext.globalAlpha = renderObject.layer.opacity;
        canvasContext.globalCompositeOperation = renderObject.layer.blendmode;
        canvasContext.drawImage(
            drawElement(renderObject),
            0,
            0,
            format.width,
            format.height
        );
    });

    if (_background.generate) {
        canvasContext.globalCompositeOperation = "destination-over";
        drawBackground(canvasContext, background);
    }
    debugLogs
        ? console.log("Editions left to create: ", abstractedIndexes)
        : null;
};

// const postProcessMetadata = (layerData) => {
//     const { abstractedIndexes, layerConfigIndex } = layerData;
//     // Metadata options
//     const savedFile = fs.readFileSync(
//         `${buildDir}/images/${abstractedIndexes[0]}${outputJPEG ? ".jpg" : ".png"}`
//     );
//     const _imageHash = hash(savedFile);
//
//     // if there's a prefix for the current configIndex, then
//     // start count back at 1 for the name, only.
//     const _prefix = layerConfigurations[layerConfigIndex].namePrefix
//         ? layerConfigurations[layerConfigIndex].namePrefix
//         : null;
//     // if resetNameIndex is turned on, calculate the offset and send it
//     // with the prefix
//     let _offset = 0;
//     if (layerConfigurations[layerConfigIndex].resetNameIndex) {
//         _offset = layerConfigurations[layerConfigIndex - 1].growEditionSizeTo;
//     }
//
//     return {
//         _imageHash,
//         _prefix,
//         _offset,
//     };
// };

// const outputFiles = (
//     abstractedIndexes,
//     layerData,
//     _buildDir = buildDir,
//     _canvas = canvas
// ) => {
//     const { newDna, layerConfigIndex } = layerData;
//     // Save the canvas buffer to file
//     saveImage(abstractedIndexes[0], _buildDir, _canvas);
//
//     const { _imageHash, _prefix, _offset } = postProcessMetadata(layerData);
//
//     addMetadata(newDna, abstractedIndexes[0], {
//         _prefix,
//         _offset,
//         _imageHash,
//     });
//
//     saveMetaDataSingleFile(abstractedIndexes[0], _buildDir);
//     console.log(`Created edition: ${abstractedIndexes[0]}`);
// };

export const startCreating =  (prng) => {
    // if (storedDNA) {
    //     console.log(`using stored dna of ${storedDNA.size}`);
    //     dnaList = storedDNA;
    //     dnaList.forEach((dna) => {
    //         const editionExp = /\d+\//;
    //         const dnaWithoutEditionNum = dna.replace(editionExp, "");
    //         uniqueDNAList.add(filterDNAOptions(dnaWithoutEditionNum));
    //     });
    // }
    let layerConfigIndex = 0;
    let editionCount = 1; //used for the growEditionSize while loop, not edition number
    let failedCount = 0;
    let abstractedIndexes = [];
    for (
        let i = startIndex;
        i <=
        startIndex +
        layerConfigurations[layerConfigurations.length - 1].growEditionSizeTo -
        1;
        i++
    ) {
        abstractedIndexes.push(i);
    }
    if (shuffleLayerConfigurations) {
        abstractedIndexes = shuffle(abstractedIndexes,prng);
    }
    debugLogs
        ? console.log("Editions left to create: ", abstractedIndexes)
        : null;

    const configToSelect = layerConfigurations.map((layerConfig, index) => [index, layerConfig.growEditionSizeTo])
    const configToCreateidx = prng.randomWeighted(new Map(configToSelect));//layerConfigurations[];

const asdas=configToCreateidx+2;
    console.log(asdas)
    //grab random config using growEditionSizeTo for weight
    while (layerConfigIndex < layerConfigurations.length) {

        const layers = fileList[configToCreateidx];

        while (
            editionCount <= layerConfigurations[layerConfigIndex].growEditionSizeTo
            ) {
            let newDna = createDna(layers,prng);
            if (isDnaUnique(newDna)) {
                let results = constructLayerToDna(newDna, layers);
                debugLogs ? console.log("DNA:", newDna.split(DNA_DELIMITER)) : null;
                let loadedElements = [];
                // reduce the stacked and nested layer into a single array
                const allImages = results.reduce((images, layer) => {
                    return [...images, ...layer.selectedElements];
                }, []);
                const _renderObjects = sortZIndex(allImages);

                _renderObjects.forEach((layer) => {
                    addAttributes({layer});
                })
                const attributesOut = attributesList;
                attributesList=[];
                return {layers:_renderObjects, attributes:attributesOut};

                //     .forEach((layer) => {
                //     loadedElements.push(loadLayerImg(layer));
                // });

                // await Promise.all(loadedElements).then((renderObjectArray) => {
                //     const layerData = {
                //         newDna,
                //         layerConfigIndex,
                //         abstractedIndexes,
                //         _background: background,
                //     };
                //     paintLayers(ctxMain, renderObjectArray, layerData);
                //     // outputFiles(abstractedIndexes, layerData);
                // });

                // prepend the same output num (abstractedIndexes[0])
                // to the DNA as the saved files.
                dnaList.add(
                    `${abstractedIndexes[0]}/${newDna}${
                        generatedBackground ? "___" + generatedBackground : ""
                    }`
                );
                uniqueDNAList.add(filterDNAOptions(newDna));
                editionCount++;
                abstractedIndexes.shift();
            } else {
                console.log("DNA exists!");
                failedCount++;
                if (failedCount >= uniqueDnaTorrance) {
                    console.log(
                        `You need more layers or elements to grow your edition to ${layerConfigurations[layerConfigIndex].growEditionSizeTo} artworks!`
                    );
                    process.exit();
                }
            }
        }
        layerConfigIndex++;
    }
    writeMetaData(JSON.stringify(metadataList, null, 2));
    writeDnaLog(JSON.stringify([...dnaList], null, 2));
};
