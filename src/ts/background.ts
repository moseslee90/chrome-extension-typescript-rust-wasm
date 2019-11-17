import "../img/icon-128.png";
import "../img/icon-34.png";
// @ts-ignore
const js = import("../../pkg/harlo_wasm.js");
js.then(js => {
    js.run();
});
// test
