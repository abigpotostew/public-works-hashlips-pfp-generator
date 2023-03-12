import * as p5 from 'p5';
import {generateTraits} from "./traits";
import {MODE} from "./lib/hashlips/constants/blend_mode";
import {layersDir} from "./config";

let s = (sk) => {
    const {layers, attributes, traits} = generateTraits(createPrng());

    let layersLoaded=[]
    sk.preload = () => {
        console.log('loading layers')
        for (let i = 0; i < layers.length; i++) {
            let path = layers[i].path;
            path = path.replace(layersDir, '/layers')
            layersLoaded[i] = sk.loadImage(`${encodeURIComponent(path)}`);
        }
        console.log('finished loading layers')
    }
    sk.setup = () => {
        const dimensions = getDimensions();
        sk.createCanvas(...dimensions)
    }

    const getBlendMode=(blend)=>{
        switch (blend) {
            case 'ADD':
                return sk.ADD
            case 'BLEND':
                return sk.BLEND
            case MODE.darken:
                return sk.DARKEST
            case MODE.difference:
                return sk.DIFFERENCE
            case MODE.exclusion:
                return sk.EXCLUSION
            case MODE.hardLight:
                return sk.HARD_LIGHT
            case MODE.lighten:
                return sk.LIGHTEST
            case MODE.multiply:
                return sk.MULTIPLY
            case MODE.overlay:
                return sk.OVERLAY
            case MODE.xor:
                return sk.REPLACE
            case MODE.screen:
                return sk.SCREEN
            case MODE.softLight:
                return sk.SOFT_LIGHT
            default:
                return null
        }
    }

    sk.draw = () => {
        const bg = sk.color(0);
        sk.background(bg)
        for (let layersLoadedElement of layersLoaded) {
            sk.push()
            if(layersLoadedElement.blend){
                const blendMode = getBlendMode(layersLoadedElement.blend)
                blendMode&& sk.blendMode(blendMode)
            }
            if(layersLoadedElement.opacity) {
                sk.tint(255, layersLoadedElement.opacity*255); // Display at half opacity
            }

            sk.image(layersLoadedElement, 0, 0, sk.width, sk.height)
            sk.pop()
        }

        setTimeout(() => {
            setProperties(attributes, traits);
            setPreviewReady()
        },2500)
        sk.noLoop()
    }
    const getDimensions = () => {
        let desiredHeight = sk.windowHeight
        let desiredWidth = sk.windowHeight;
        if (desiredWidth > sk.windowWidth) {
            desiredWidth = sk.windowWidth;
            desiredHeight = sk.windowWidth;
        }
        return [desiredWidth, desiredHeight]
    }
    sk.windowResized = () => {
        if (!isPWPreview()) {
            const dimensions = getDimensions();
            sk.resizeCanvas(...dimensions);
            // redraw at new dimensions
            sk.loop()
        }
    }
}

export const createSketch = () => {
    return new p5(s, document.getElementById('root'));
}
