# Older changes
### 2.0.4-alpha.2 (2023-09-06)
* (baerengraben) Dummy-Deploy - because npm did not get 2.0.4-alpha.1 (2nd try...)

### 2.0.4-alpha.1 (2023-09-05)
* (baerengraben) Fixing https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/102
* (baerengraben) Using ioBroker "formatDate" to format date_time attribut to "TT.MM.JJJJ SS:mm:ss"
* (baerengraben) Fixing https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/105
* (baerengraben) Fixing https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/104 
* (baerengraben) Fixing https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/103

### 2.0.4-alpha.0 (2023-08-03)
* (baerengraben) Adding four new hour-based Views 
* (baerengraben) JSON-Chart is now starting with 00:00 instead of 01:00 
* (baerengraben) SRF sometimes delivers more and sometimes less daily data. This can lead to old data in certain objects. To prevent this, I delete the entire object tree with each new call to rebuild it.

### 2.0.3 (2023-08-01)
* (baerengraben) Fixing https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/94
## 2.0.2 (2023-07-31)
* (baerengraben) Just another freaking release-script test

## 2.0.0 (2023-07-31) - Release for SRF Weather API Version 2!
* (baerengraben) Update SRF API version 1 to version 2 https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/94. With this Update new attributes are available: symbol24_code, DEWPOINT_C, RELHUM_PERCENT, FRESHSNOW_CM, PRESSURE_HPA, SUN_MIN, IRRADIANCE_WM2 and TTTFEEL_C

## 1.0.6
* (baerengraben) Fixing https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/78
* (baerengraben) Fixing https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/93
* (baerengraben) Fixing https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/97

## 1.0.5
* (baerengraben) Fixing https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/81
* (baerengraben) Fixing https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/76
* (baerengraben) Fixing https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/75

## 1.0.4
* (baerengraben) Fixing https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/85
* (baerengraben) Fixing https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/82

## 1.0.3
* (baerengraben) Fixing https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/67
* (baerengraben) Fixing https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/66
* (baerengraben) Fixing https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/52

## 1.0.2
* (baerengraben) Fixing https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/51
* (baerengraben) Fixing https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/53

## 1.0.1
* (baerengraben) Fixing https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/57
This change makes it necessary to regenerate IDs. So, to install version 1.0.1, the currently running adapter instance must be completely removed and replaced with a new instance.

## 1.0.0
* (baerengraben) Bugfix https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/64