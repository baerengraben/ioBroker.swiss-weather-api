// Don't silently swallow unhandled rejections
process.on("unhandledRejection", (e) => {
	throw e;
});

// enable the should interface with sinon
// and load chai-as-promised and sinon-chai by default
const sinonChai = import("sinon-chai");
const chaiAsPromised = import("chai-as-promised");
const { should, use } = import("chai");

//should();
use(sinonChai);
use(chaiAsPromised);