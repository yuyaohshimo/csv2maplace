'use strict';

var fs = require('fs');
var Converter = require('csvtojson').core.Converter;
var gm = require('googlemaps');
var async = require('async');

var nodeUtil = require('util');

var fileName = process.argv[2];

if (!fileName) {
  console.log('error: please input file name');
  process.exit();
}

async.waterfall([

  function(callback) {
    // csv to json
    var fileStream = fs.createReadStream(nodeUtil.format('./csv/%s.csv', fileName));

    // err
    fileStream.on('error', function(err) {
      callback(err);
    });

    var csvConverter = new Converter();

    //end_parsed will be emitted once parsing finished
    csvConverter.on("end_parsed", function(shopData){
       callback(null, shopData);
    });

    //read from file
    fileStream.pipe(csvConverter);
  },
  function(shopData, callback) {
    // format json for maplace.js
    var newShopData = [];

    async.eachLimit(shopData, 10, function(shop, done) {
      var address = nodeUtil.format('%s%s%s', shop.shop_prefecture_ward, shop.shop_street_number, shop.shop_building_name);

      if (!address) {
        return done();
      }

      gm.geocode(address, function(err, res) {
        if (res && res.results && res.results.length) {

          console.log('complete: ', shop.shop_name);

          var newData = {
            lat: res.results[0].geometry.location.lat,
            lon: res.results[0].geometry.location.lng,
            title: shop.shop_name,
            html: nodeUtil.format('<h3>%s</h3><dl><dt>住所</dt><dd>%s</dd><dt>TEL</dt><dd>%s</dd></dl>', shop.shop_name, address, shop.phone_number),
            icon: ''
          };

          if (shop.homepage) {
            newData.html += nodeUtil.format('<dl><dt>URL</dt><dd>%s</dd></dl>', shop.homepage);
          }

          newShopData.push(newData);
        } else {
          console.log('error in the ', shop.shop_name);
          console.log('err: ', err);
          console.log('res: ', res);
        }

        // prevent 'OVER_QUERY_LIMIT'
        setTimeout(function() {
          done();
        }, 2000);
      });
    }, function(err) {
      fs.writeFile(nodeUtil.format('./json/%s.json', fileName), JSON.stringify(newShopData), function(err) {
        if (err) {
          callback(err);
        } else {
          callback();
        }
      });
    });
  }

], function(err, results) {
  if (err) {
    console.log(err);
  } else {
    console.log(nodeUtil.format('export %s.json', fileName));
  }
});