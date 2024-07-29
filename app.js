const hubspot = require("./src/services/hubspot/hubspot.service");

function app() {
  hubspot.run();
}

app();
