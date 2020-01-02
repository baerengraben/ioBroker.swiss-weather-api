![Logo](admin/swiss-weather-api.png)
# ioBroker.swiss-weather-api

[![NPM version](http://img.shields.io/npm/v/iobroker.swiss-weather-api.svg)](https://www.npmjs.com/package/iobroker.swiss-weather-api)
[![Downloads](https://img.shields.io/npm/dm/iobroker.swiss-weather-api.svg)](https://www.npmjs.com/package/iobroker.swiss-weather-api)
![Number of Installations (latest)](http://iobroker.live/badges/swiss-weather-api-installed.svg)
![Number of Installations (stable)](http://iobroker.live/badges/swiss-weather-api-stable.svg)
[![Dependency Status](https://img.shields.io/david/baerengraben/iobroker.swiss-weather-api.svg)](https://david-dm.org/baerengraben/iobroker.swiss-weather-api)
[![Known Vulnerabilities](https://snyk.io/test/github/baerengraben/ioBroker.swiss-weather-api/badge.svg)](https://snyk.io/test/github/baerengraben/ioBroker.swiss-weather-api)

[![NPM](https://nodei.co/npm/iobroker.swiss-weather-api.png?downloads=true)](https://nodei.co/npm/iobroker.swiss-weather-api/)

**Tests:**: [![Travis-CI](http://img.shields.io/travis/baerengraben/ioBroker.swiss-weather-api/master.svg)](https://travis-ci.org/baerengraben/ioBroker.swiss-weather-api)

## swiss-weather-api adapter for ioBroker

Connects to free and great SRG-SSR weather API (https://developer.srgssr.ch/apis/srgssr-weather).  
Weather-Icons are reused from https://erikflowers.github.io/weather-icons/

The SRG-SSR Weather REST API allows you to get weather forecasts and reports from more than 25.000 locations across Switzerland.
### Getting started
1. Get a free accout on https://developer.srgssr.ch/
1. Go to "My Apps" and create a new App. This will create a specific ConsumerKey and ConsumerSecret
1. Find out Longitude / Latitude of the chosen location for wich forecast is needed
1. Install this Adapter on ioBroker
1. On Adapter Configuration fill in
   1. ConsumerKey of App
   1. ConsumerSecret of App
   1. Longitude / Latitude of the chosen location for wich forecast is needed

This is a scheduled Adapter. It is scheduled every 15 minutes and reads the forecast API of SRG-SSR. Feel free to change the scheduler intervall in instance-view (Schedule).    



### internal remarks - will be removed
You are almost done, only a few steps left:
1. Create a new repository on GitHub with the name `ioBroker.swiss-weather-api`
1. Initialize the current folder as a new git repository:  
	```bash
	git init
	git add .
	git commit -m "Initial commit"
	```
1. Link your local repository with the one on GitHub:  
	```bash
	git remote add origin https://github.com/baerengraben/ioBroker.swiss-weather-api
	```

1. Push all files to the GitHub repo:  
	```bash
	git push origin master
	```
1. Head over to [main.js](main.js) and start programming!

### Scripts in `package.json` - will be removed
Several npm scripts are predefined for your convenience. You can run them using `npm run <scriptname>`
| Script name | Description                                              |
|-------------|----------------------------------------------------------|
| `test:js`   | Executes the tests you defined in `*.test.js` files.     |
| `test:package`    | Ensures your `package.json` and `io-package.json` are valid. |
| `test` | Performs a minimal test run on package files and your tests. |
| `coverage` | Generates code coverage using your test files. |

### Writing tests - will be removed
When done right, testing code is invaluable, because it gives you the 
confidence to change your code while knowing exactly if and when 
something breaks. A good read on the topic of test-driven development 
is https://hackernoon.com/introduction-to-test-driven-development-tdd-61a13bc92d92. 
Although writing tests before the code might seem strange at first, but it has very 
clear upsides.

The template provides you with basic tests for the adapter startup and package files.
It is recommended that you add your own tests into the mix.

### Publishing the adapter - will be removed
Since you have chosen GitHub Actions as your CI service, you can 
enable automatic releases on npm whenever you push a new git tag that matches the form 
`v<major>.<minor>.<patch>`. The necessary steps are described in `.github/workflows/test-and-release.yml`.

To get your adapter released in ioBroker, please refer to the documentation 
of [ioBroker.repositories](https://github.com/ioBroker/ioBroker.repositories#requirements-for-adapter-to-get-added-to-the-latest-repository).

### Test the adapter manually on a local ioBroker installation - will be removed
In order to install the adapter locally without publishing, the following steps are recommended:
1. Create a tarball from your dev directory:  
	```bash
	npm pack
	```
1. Upload the resulting file to your ioBroker host
1. Install it locally (The paths are different on Windows):
	```bash
	cd /opt/iobroker
	npm i /path/to/tarball.tgz
	```

For later updates, the above procedure is not necessary. Just do the following:
1. Overwrite the changed files in the adapter directory (`/opt/iobroker/node_modules/iobroker.swiss-weather-api`)
1. Execute `iobroker upload swiss-weather-api` on the ioBroker host

## Changelog

### 0.0.1
* (baerengraben) initial release

### 0.0.2
* (baerengraben) first running version. Reads Current Forecast (https://api.srgssr.ch/forecasts/v1.0/weather/current)


## License
MIT License

Copyright (c) 2019 baerengraben <baerengraben@intelli.ch>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.