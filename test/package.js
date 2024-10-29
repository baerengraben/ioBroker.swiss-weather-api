const path = import("path");
const { tests } = import("@iobroker/testing");

// Validate the package files
tests.packageFiles(path.join(__dirname, ".."));
