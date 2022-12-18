const app = require("./app");

app.listen(process.env.PORT || 4000, () => {
  console.log("Started server at port 4000");
});
