const sharp = require('sharp');
const axios = require('axios');

// Define the ImageAnalyzer class
class ImageAnalyzer {
    constructor() {
        this.resizedLogo = {};
    }

    // 1. Function to check if the logo can be placed based on dimensions
    async canLogoFit({ imageBuffer, logoWidth, logoHeight }) {
        const metadata = await sharp(imageBuffer).metadata();
        const { width, height } = metadata;

        // Check if the logo can fit within the image dimensions
        return logoWidth <= width && logoHeight <= height;
    }

    // 2. Function to check if a region has a uniform color (color consistency check)
    async isColorUniform({ imageBuffer, x, y, width, height, tolerance = 10 }) {
        const region = await sharp(imageBuffer)
            .extract({ left: x, top: y, width, height })
            .raw()
            .toBuffer();

        // First pixel values for color consistency check
        const [r0, g0, b0] = [region[0], region[1], region[2]];

        // Check for color consistency
        for (let i = 0; i < region.length; i += 3) {
            const [r, g, b] = [region[i], region[i + 1], region[i + 2]];
            if (
                Math.abs(r - r0) > tolerance ||
                Math.abs(g - g0) > tolerance ||
                Math.abs(b - b0) > tolerance
            ) {
                return false; // Region is not uniform
            }
        }
        return true; // Region is uniform
    }

    // 3. Function to check brightness
    async isBrightEnough({ imageBuffer, x, y, width, height }) {
        const region = await sharp(imageBuffer)
            .extract({ left: x, top: y, width, height })
            .greyscale()
            .raw()
            .toBuffer();

        const totalPixels = region.length;
        const brightness = region.reduce((sum, value) => sum + value, 0) / totalPixels;

        return brightness > 128; // True if bright enough, false if too dark
    }

    // 4. Function to check space availability and select the correct logo
    async checkLogoSpace({ imageBuffer, logoWidth, logoHeight, darkLogoBuffer, lightLogoBuffer }) {
        const metadata = await sharp(imageBuffer).metadata();
        const { width, height } = metadata;

        const marginX = 5; // Margin to ensure the logo doesn't touch the edges
        const marginY = 5;

        if (logoHeight + marginY > height) {
            console.log("Logo height is too large to fit in the image.");
            return null;
        }

        // Check top-left corner
        const topLeftHasSpace = await this.isColorUniform({ imageBuffer, x: marginX, y: marginY, width: logoWidth, height: logoHeight });
        const topLeftIsBright = await this.isBrightEnough({ imageBuffer, x: marginX, y: marginY, width: logoWidth, height: logoHeight });

        // Check top-right corner
        const topRightHasSpace = await this.isColorUniform({ imageBuffer, x: width - logoWidth - marginX, y: marginY, width: logoWidth, height: logoHeight });
        const topRightIsBright = await this.isBrightEnough({ imageBuffer, x: width - logoWidth - marginX, y: marginY, width: logoWidth, height: logoHeight });

        const logoToUseTopLeft = topLeftIsBright ? lightLogoBuffer : lightLogoBuffer;
        const logoToUseTopRight = topRightIsBright ? lightLogoBuffer : lightLogoBuffer;

        return {
            topLeftHasSpace,
            topRightHasSpace,
            topLeftIsBright,
            topRightIsBright,
            logoToUseTopLeft,
            logoToUseTopRight,
            marginX,
            marginY,
            imageWidth: width,
            imageHeight: height
        };
    }

    // 5. Function to place the logo
    async placeLogo({ imageBuffer, logoBuffer, x, y, outputFilename }) {
        await sharp(imageBuffer)
            .composite([{ input: logoBuffer, left: x, top: y }])
            .toFile(outputFilename);
    }

    // Main function to fetch images and place the logo
    async fetchImageAndPlaceLogo({ imageUrl, darkLogoUrl, lightLogoUrl, tried = false }) {
        try {
            // Fetch base image
            const imageResponse = this.resizedLogo?.imageBuffer || await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imageBuffer = this.resizedLogo?.imageBuffer || Buffer.from(imageResponse.data, 'binary');

            // Fetch both dark and light logos
            const darkLogoResponse = this.resizedLogo?.darkLogoBuffer || (darkLogoUrl && await axios.get(darkLogoUrl, { responseType: 'arraybuffer' }));
            const darkLogoBuffer = this.resizedLogo?.darkLogoBuffer || (darkLogoResponse && buffer.from(darkLogoResponse.data, 'binary'));

            const lightLogoResponse = this.resizedLogo?.lightLogoBuffer || (lightLogoUrl && await axios.get(lightLogoUrl, { responseType: 'arraybuffer' }));
            const lightLogoBuffer = this.resizedLogo?.lightLogoBuffer || (lightLogoResponse && Buffer.from(lightLogoResponse.data, 'binary'));

            // Get logo dimensions
            const darkLogoMetadata = await sharp((darkLogoBuffer || lightLogoBuffer)).metadata();
            const logoWidth = darkLogoMetadata.width;
            const logoHeight = darkLogoMetadata.height;

            // Check if the logo can be placed based on its dimensions
            const canFit = await this.canLogoFit({ imageBuffer, logoWidth, logoHeight });
            if (!canFit && !tried) {
                return await this.adjustLogoSize({ logoBuffer: darkLogoBuffer, logoWidth, logoHeight, tried: true });
            }

            // Check space and determine which logo to use (dark or light)
            const spaceResult = await this.checkLogoSpace({ imageBuffer, logoWidth, logoHeight, darkLogoBuffer, lightLogoBuffer });
            const path =  `images/${new Date().getTime() + Math.floor(Math.random() * 16545)}.jpg`;
            if (spaceResult.topLeftHasSpace) {
                await this.placeLogo({
                    imageBuffer,
                    logoBuffer: spaceResult.logoToUseTopLeft,
                    x: spaceResult.marginX,
                    y: spaceResult.marginY,
                    outputFilename:path
                });
                
                console.log(`Logo placed on the top-left corner and saved as output.jpg.`);
            } else if (spaceResult.topRightHasSpace) {
                await this.placeLogo({
                    imageBuffer,
                    logoBuffer: spaceResult.logoToUseTopRight,
                    x: spaceResult.imageWidth - logoWidth - spaceResult.marginX,
                    y: spaceResult.marginY,
                    outputFilename: path
                });
                console.log(`Logo placed on the top-right corner and saved as output.jpg.`);
            } else if (!tried) {
                const dark_logo = await this.adjustLogoSize({ logoBuffer: darkLogoBuffer, logoWidth, logoHeight });
                const light_logo = await this.adjustLogoSize({ logoBuffer: lightLogoBuffer, logoWidth, logoHeight });
                this.resizedLogo = {
                    imageBuffer,
                    darkLogoBuffer: dark_logo,
                    lightLogoBuffer: light_logo
                }
                console.log("No suitable space for logo in either corner.");
                return await this.fetchImageAndPlaceLogo({ imageUrl, darkLogoUrl, lightLogoUrl, tried: true });
            }
            return path;
        } catch (error) {
            console.error('Error fetching or processing the images:', error);
        }
    }

    async resizeLogo({ logoBuffer, newLogoWidth, newLogoHeight }) {
        try {
            // Use sharp to resize the logo
            const resizedLogoBuffer = await sharp(logoBuffer)
                .resize({
                    width: Math.round(newLogoWidth),
                    height: Math.round(newLogoHeight),
                    fit: sharp.fit.inside,
                    withoutEnlargement: true
                })
                .toBuffer();

            console.log("Logo resized successfully.");
            return resizedLogoBuffer;

        } catch (err) {
            console.error("Error resizing the logo: ", err);
            throw err;
        }
    }

    async adjustLogoSize({ logoBuffer, logoWidth, logoHeight }) {
        try {
            // Resizing logo to 75% of its original dimensions
            const scaleFactor = 0.75;
            const newLogoWidth = logoWidth * scaleFactor;
            const newLogoHeight = logoHeight * scaleFactor;

            console.log(`Resizing logo to 75% of its original size: ${Math.round(newLogoWidth)}x${Math.round(newLogoHeight)}.`);

            // Resize the logo using the resizeLogo function
            return await this.resizeLogo({ logoBuffer, newLogoWidth, newLogoHeight });
        } catch (error) {
            console.error("Error resizing the logo:", error);
            return false;
        }
    }
}
module.exports = ImageAnalyzer