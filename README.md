# Public Works PFP Generator Template

A fork of `nftchef hashlips` PFP generator for publicworks.art.

This is not a typical PFP generator. Due to the way PublicWorks is designed-- you cannot ensure uniqueness in your PFP set. You also cannot enforce ultra rare NFTs will be minted. Instead, you need to ensure that there's a sufficiently large enough amount of randomness in your layers that the same PFP is statistically unlikely to be generated twice.

## Setup
* Install node 16+ `https://nodejs.org/en/download/`
* Clone or use this project as a template `https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template`
* Open the project folder in a terminal application `cd public-works-no-code-hashlips`
* Run `npm install` to install dependencies
* Run `npm run dev` to launch the dev server and open the url `http://localhost:8080/`

## Configuration
* Add your `layers` folder into the `hashlips` directory, following the nftchef hashlips fork (https://github.com/nftchef/art-engine) file layout
* Update the hashlips config in `src/config.js` to match your layers.
* Whenever you update config or layers, you must restart the dev server to see changes.
* Click, touch, or press spacebar to create a new hash.

## Deployment
When you're satisfied with testing you can test the project out on PublicWorks.
* Turn off `devMode` in `src/config.js` by setting `const devMode = false;`
* Run `npm run build` to build the project.A zip file in `dist-zipped/project.zip` is created.
* Create a work on `testnet.publicworks.art/create` and upload this as your work code.
* Follow the remaining docs on `testnet.publicworks.art/docs` to public your work.




