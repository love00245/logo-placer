const express = require('express');
const app = express()
const port = 3000
const utilities = require("./utilities");
const ImageAnalyzer = require("./logoPlacer");
const path = require("path");

app.get('/', (req, res) => {
    res.send('Hello To Logo Placer! Please go to /readme for full documentations');
})

app.use("/images", express.static(path.join(__dirname, 'images')));

app.get('/readme', (req, res) => {
    const html = `
                <!doctype html>
<html>

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
</head>

<body>
  <div>
    <h1 class="text-3xl font-bold underline text-center ">
      Hello to Logo Placer!
    </h1>
  </div>

  <div class="bg-slate-500 mt-10 text-center text-2xl text-white">
    Documentation / Routes
  </div>
  <div class="bg-slate-500 mt-5 pl-10 text-2xl text-white">
    <div>
      <h2>Routes :- /placeLogo [post] </h2>
    </div>
    <div class="mt-2">
      <h2>Fields :- </br> 1. image (string) (on which logo needs to be placed) </br>
        2. logo (string) (which needs to be placed)</h2>
    </div>
  </div>
</body>

</html>`;
    res.send(html);
})

app.post('/placeLogo', async (req, res) => {
    // const { logo = './logo.jpeg', image = './image.webp' } = req.body;

    const logo = `https://practina-test.s3.us-west-2.amazonaws.com/buss_img/buss_imgIcon_buss_id_14251_1726070810105`
    const image = "https://images.pexels.com/photos/411207/pexels-photo-411207.jpeg?auto=compress&cs=tinysrgb&w=1200";
    if (!utilities.validateEmptyFields({ value: logo, type: "string" })) res.send("Please enter valid logo");
    if (!utilities.validateEmptyFields({ value: image, type: "string" })) res.send("Please enter valid image");
    const ImageAnalyzer_ = new ImageAnalyzer();
    const new_image = await ImageAnalyzer_.fetchImageAndPlaceLogo({ imageUrl: image, lightLogoUrl: logo });
    res.send({
        image: "http://localhost:3000/" + new_image
    });
})


// INVALID ROUTES HANDLER
const routesHandler = (req, res) => {
    res.redirect("http://localhost:3000/readme");
}
app.use(routesHandler);


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
})
