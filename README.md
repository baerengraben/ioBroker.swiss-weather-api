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

Connects to the great SRG-SSR weather API (https://developer.srgssr.ch/apis/srgssr-weather).  
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

## Changelog

### 0.1.0
* (baerengraben) Running version. Reads the complete weather forecast from https://api.srgssr.ch

### 0.0.2
* (baerengraben) first running version. Reads Current Forecast (https://api.srgssr.ch/forecasts/v1.0/weather/current)

### 0.0.1
* (baerengraben) initial release


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