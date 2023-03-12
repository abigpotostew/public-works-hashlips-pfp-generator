import {startCreating} from "./lib/hashlips/hl-web";

const mapDecimalToWord = (value, lo = 0, hi = 1) => {
    const normal = (value - lo) / (hi - lo);
    if (normal < .5) {
        return 'Low'
    } else if (normal < 0.75) {
        return 'Medium';
    } else {
        return 'High'
    }
}
export const generateTraits = (prng) => {

    const {layers,attributes} = startCreating(prng)
    console.log('layers',layers)
    console.log('attributes',attributes)

    return {attributes, layers}
}
