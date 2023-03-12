# Public Works PFP Generator Template

A hash lips based PFP generator.

## Usage
Clone or use this project as a template `https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template`

Add your layers folder into the `hashlips` directory.

Update the hashlips config in `src/config.js` to match your layers.

Click, touch, or press spacebar to create a new hash.

## Work Requirements
* Your work must be self-contained-- any external calls will be blocked during the preview rendering pipeline.
* Your work must set `window.previewReady = true` when the preview is complete. Otherwise, a snapshot will be taken after 60 seconds.
* Attributes and traits must be a javascript object where keys are the attribute names and values one of `string`, `number` or `boolean`. Any other type will be serialized with `.toString()`.


