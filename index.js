/**
 * Plugin dependencies.
 *
 * @type {exports}
 */
var request = require('request');
var cheerio = require('cheerio');
var shorturl = require('shorturl');
var _ = require('lodash');

/**
 * Nettibaari plugin for UniBot.
 *
 * This plugin fetches drink recipes from http://nettibaari.puhti.com/ website.
 *
 * @param   {Object} options Plugin options object, description below.
 *   db: {mongoose} the mongodb connection
 *   bot: {irc} the irc bot
 *   web: {connect} a connect + connect-rest webserver
 *   config: {object} UniBot configuration
 *
 * @return  {Function}  Init function to access shared resources
 */
module.exports = function init(options) {
    var config = options.config || {};

    /**
     * Default plugin configuration. These can be override on your UniBot config.js file, just add 'nettibaari' section
     * to your plugin section.
     *
     * @type    {{
     *              message: string
     *          }}
     */
    var pluginConfig = {
        "message": "${title}: ${substances} - ${alcohol} - ${shortUrl}"
    };

    // Merge configuration for plugin
    if (_.isObject(config.plugins) && _.isObject(config.plugins.nettibaari)) {
        pluginConfig = _.merge(pluginConfig, config.plugins.nettibaari);
    }

    String.prototype.strip = function() {
        var translate_re = /[öäüÖÄÜß ]/g;
        var translate = {
            'ä':'a', 'ö':'o', 'ü':'u',
            'Ä':'A', 'Ö':'O', 'Ü':'U',
            ' ':'_', 'ß':'ss'
        };

        return (this.replace(translate_re, function(match){
            return translate[match];})
        );
    };

    // Actual plugin implementation.
    return function plugin(channel) {
        // Regex rules for plugin
        return {
            '^!drinkki(?: (.*))?$': function onMatch(from, matches) {
                var drink = 'Random';

                // Possible drink name given, so normalize it
                if (matches[1]) {
                    drink = matches[1].strip().replace(/[^A-Za-z0-9-_]/g, '');
                }

                // Specify URL for the drink
                var url = 'http://nettibaari.puhti.com/drinkkiohje/' + drink;

                // Make request to fetch drink data
                request({uri: url}, function(error, response, body) {
                    var $ = cheerio.load(body);
                    var substances = [];

                    // Iterate drink substances and normalize those
                    $('div.object').find('ul.Data:first-of-type li').each(function() {
                        var elem = $(this);

                        substances.push((elem.find('span').text().trim() + ' ' + elem.find('a').text().trim()).trim());
                    });

                    // Drink template data
                    var drink = {
                        title: $('title').text().split('|')[0].trim(),
                        substances: substances.join(', '),
                        alcohol: $('div.meta').find('dd.low').eq(1).find('strong').text().trim(),
                        url: url
                    };

                    // Yeah actual drink found
                    if (drink.title !== 'Haku') {
                        shorturl(url, function done(shortUrl) {
                            drink.shortUrl = shortUrl;

                            channel.say(_.template(pluginConfig.message, drink));
                        });
                    }
                });
            }
        };
    };
};
