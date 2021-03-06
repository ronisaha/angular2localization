/**
 * ANGULAR 2 LOCALIZATION
 * An Angular 2 library to translate messages, dates and numbers.
 * Written by Roberto Simonetti.
 * MIT license.
 * https://github.com/robisim74/angular2localization
 */

import { Injectable, EventEmitter, Output } from '@angular/core';
import { Http, Response } from '@angular/http';
import { Observer } from 'rxjs/Observer';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map';

// Services.
import { LocaleService } from './locale.service';
import { IntlSupport } from './Intl-support';

/**
 * LocalizationService class.
 * Gets the translation data and performs operations.
 * 
 * @author Roberto Simonetti
 */
@Injectable() export class LocalizationService {

    /**
     * Output for event translation changed.
     */
    @Output() translationChanged: EventEmitter<string> = new EventEmitter<string>(true);

    /**
     * The language code for the service.
     */
    public languageCode: string;

    /**
     * The loading mode for the service.
     */
    public loadingMode: LoadingMode;

    /**
     * The service state. 
     */
    public serviceState: ServiceState;

    /**
     * Enable/disable locale as language.
     */
    public enableLocale: boolean = false;

    /**
     * The providers for the asynchronous loading.
     */
    private providers: Array<Provider> = [];

    /**
     * The translation data: {languageCode: {key: value}}.
     */
    private translationData: any = {};

    /**
     * Value for missing keys.
     */
    private missingValue: string;

    /**
     * Key for missing keys.
     */
    private missingKey: string;

    /**
     * Option for composed key.
     */
    private composedKey: boolean = true;

    /**
     * Separator for composed key.
     */
    private keySeparator: string = ".";

    /**
     * Requests counter.
     */
    private counter: number;

    constructor(public http: Http, public locale: LocaleService) {

        this.languageCode = "";

        // Initializes the loading mode.
        this.loadingMode = LoadingMode.Direct;

        // Initializes the service state.
        this.serviceState = ServiceState.isWaiting;

        // When the language changes, subscribes to the event & call updateTranslation method.
        this.locale.updateLocalization.subscribe(

            // Generator or next.
            () => this.updateTranslation()

        );

    }

    /**
     * Direct loading: adds new translation data.
     * 
     * @param language The two-letter code of the language for the translation data
     * @param translation The new translation data
     */
    public addTranslation(language: string, translation: any): void {

        // Adds the new translation data.
        this.addData(translation, language);

    }

    /**
     * Asynchronous loading: defines the translation provider.
     * 
     * @param prefix The path prefix of the json files
     * @param dataFormat Data format: default value is 'json'.
     * @param webAPI True if the asynchronous loading uses a Web API to get the data.
     */
    public translationProvider(prefix: string, dataFormat: string = "json", webAPI: boolean = false): void {

        this.addProvider(prefix, dataFormat, webAPI);

    }

    /**
     * Asynchronous loading: adds a translation provider.
     * 
     * @param prefix The path prefix of the json files
     * @param dataFormat Data format: default value is 'json'.
     * @param webAPI True if the asynchronous loading uses a Web API to get the data.
     */
    public addProvider(prefix: string, dataFormat: string = "json", webAPI: boolean = false): void {

        this.providers.push({ prefix, dataFormat, webAPI });

        // Updates the loading mode.
        if (this.providers.length == 1) { this.loadingMode = LoadingMode.Async; }

    }

    /**
     * Translates a key.
     * 
     * @param key The key to be translated
     * @param args Parameters
     * @param lang The current language
     * @return The value of translation
     */
    public translate(key: string, args?: any, lang: string = this.languageCode): string {

        var value: string;

        if (this.translationData[lang] != null) {

            // Gets the translation by language code. 
            var translation: any = this.translationData[lang];

            // Checks for composed key (see issue #21).
            if (this.composedKey) {
                var keys: string[] = key.split(this.keySeparator);
                do {
                    key = keys.shift();
                    if (translation[key] != null && (typeof translation[key] == "object")) {
                        translation = translation[key];
                    }
                } while (keys.length > 0);
            }

            // Gets the value of translation by key.   
            value = translation[key];

        }

        // Handles missing keys (see issues #1 & #31).
        if (value == null || value == "") {

            if (this.missingKey) {

                return this.translate(this.missingKey, args, lang);

            } else if (this.missingValue) {

                return this.missingValue;

            }

            return key; // The same key is returned.

        } else if (args != null) { // Parameters (see issue #19).

            const TEMPLATE_REGEXP: RegExp = /{{\s?([^{}\s]*)\s?}}/g;

            return value.replace(TEMPLATE_REGEXP, (substring: string, parsedKey: string) => {
                var response: string = <string>args[parsedKey];
                return (typeof response !== 'undefined') ? response : substring;
            });

        }

        return value;

    }

    /**
     * Translates a key.
     * 
     * @param key The key to be translated
     * @param args Parameters
     * @param lang The current language
     * @return An observable of the value of translation
     */
    public translateAsync(key: string, args?: any, lang: string = this.languageCode): Observable<string> {

        return new Observable<string>((observer: Observer<string>) => {

            // Gets the value of translation for the key.
            var value: string = this.translate(key, args, lang);

            observer.next(value);
            observer.complete();

        });

    }

    /**
     * Sets the use of locale as language for the service (see issue #24).
     */
    public useLocaleAsLanguage(): void {

        this.enableLocale = true;

    }

    /**
     * Gets language code and loads the translation data for the asynchronous loading.
     * 
     * @param language The language for the service
     */
    public updateTranslation(language: string = !this.enableLocale
        ? this.locale.getCurrentLanguage()
        : this.locale.getCurrentLanguage()
        + "-"
        + this.locale.getCurrentCountry()): void {

        if (language != "" && language != this.languageCode) {

            // Asynchronous loading.
            if (this.loadingMode == LoadingMode.Async) {

                // Updates the translation data.  
                this.getTranslation(language);

            } else {

                this.translationComplete(language);

            }

        }

    }

    /**
     * Sets the value to use for missing keys.
     * 
     * @param value The value to use for missing keys
     */
    public setMissingValue(value: string): void {

        this.missingValue = value;

    }

    /**
     * Sets the key to use for missing keys.
     * 
     * @param key The key to use for missing keys
     */
    public setMissingKey(key: string): void {

        this.missingKey = key;

    }

    /**
     * Sets composed key option.
     * 
     * @param composedKey False to disable composed key. Default is true
     * @param keySeparator Composed key separator. Default is the point '.'
     */
    public setComposedKey(composedKey?: boolean, keySeparator?: string): void {

        this.composedKey = composedKey;
        this.keySeparator = keySeparator;

    }

    /* Intl.Collator */

    /**
     * Compares two keys by the value of translation & the current language code.
     * 
     * @param key1, key2 The keys of the values to compare
     * @param extension
     * @param options
     * @return A negative value if the value of translation of key1 comes before the value of translation of key2; a positive value if key1 comes after key2; 0 if they are considered equal or Intl.Collator is not supported
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Collator
     */
    public compare(key1: string, key2: string, extension?: string, options?: any): number {

        // Checks for support for Intl.
        if (IntlSupport.Collator(this.locale.getCurrentLanguage()) == false) {

            return 0;

        }

        // Gets the value of translation for the keys.
        var value1: string = this.translate(key1);
        var value2: string = this.translate(key2);

        var locale: string = this.addExtension(this.locale.getCurrentLanguage(), extension);

        return new Intl.Collator(locale).compare(value1, value2);

    }

    /**
     * Sorts an array of objects or an array of arrays by the current language code.
     * 
     * @param list The array to be sorted
     * @param keyName The column that contains the keys of the values to be ordered
     * @param order 'asc' or 'desc'. The default value is 'asc'.
     * @param extension
     * @param options
     * @return The same sorted list or the same list if Intl.Collator is not supported
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Collator
     */
    public sort(list: Array<any>, keyName: any, order?: string, extension?: string, options?: any): Array<any> {

        if (list == null || keyName == null || IntlSupport.Collator(this.locale.getCurrentLanguage()) == false) { return list; }

        // Gets the value of translation for the keys.
        for (let item of list) {

            // Gets the value of translation for the key.
            var value: string = this.translate(item[keyName]);
            // Adds a new column for translated values.
            var translated: string = keyName.concat("Translated");
            // Updates the value in the list.
            item[translated] = value;

        }

        var locale: string = this.addExtension(this.locale.getCurrentLanguage(), extension);

        // Intl.Collator.
        var collator: Intl.Collator = new Intl.Collator(locale, options); // It can be passed directly to Array.prototype.sort.

        list.sort((a: any, b: any) => {

            return collator.compare(a[translated], b[translated]);

        });

        // Removes the column of translated values.
        var index: number = list.indexOf(translated, 0);
        if (index > -1) {
            list.splice(index, 1);
        }

        // Descending order.
        if (order != null && order == "desc") {

            list.reverse();

        }

        return list;

    }

    /**
     * Sorts an array of objects or an array of arrays by the current language code.
     * 
     * @param list The array to be sorted
     * @param keyName The column that contains the keys of the values to be ordered
     * @param order 'asc' or 'desc'. The default value is 'asc'.
     * @param extension
     * @param options
     * @return An observable of the sorted list or of the same list if Intl.Collator is not supported
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Collator
     */
    public sortAsync(list: Array<any>, keyName: any, order?: string, extension?: string, options?: any): Observable<Array<any>> {

        return new Observable<any>((observer: Observer<Array<any>>) => {

            // Gets the sorted list.
            observer.next(this.sort(list, keyName, order, extension, options));
            observer.complete();

        });

    }

    /**
     * Matches a string into an array of objects or an array of arrays.
     * 
     * @param s The string to search
     * @param list The array to look for
     * @param keyNames An array that contains the columns to look for
     * @param options
     * @return A filtered list or the same list if Intl.Collator is not supported
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Collator
     */
    public search(s: string, list: Array<any>, keyNames: any[], options: any = { usage: 'search' }): Array<any> {

        if (list == null || keyNames == null || s == "" || IntlSupport.Collator(this.locale.getCurrentLanguage()) == false) { return list; }

        // Gets the value of translation for the each column.
        var translated: Array<string> = new Array<string>();

        var i: number = 0;
        for (var i: number = 0; i < keyNames.length; i++) {

            // Adds a new column for translated values.
            translated.push(keyNames[i].concat("Translated"));

            for (let item of list) {

                // Gets the values of translation for the column.
                var value: string = this.translate(item[keyNames[i]]);
                // Updates the value in the list.
                item[translated[i]] = value;

            }

        }

        var locale: string = this.locale.getCurrentLanguage();

        // Intl.Collator.
        var collator: Intl.Collator = new Intl.Collator(locale, options);

        var matches: Array<any> = list.filter((v: any) => {

            var found: boolean = false;
            for (var i: number = 0; i < translated.length; i++) {

                // Calls matching algorithm.
                if (this.match(v[translated[i]], s, collator)) {

                    found = true;
                    break;

                }

            }

            return found;

        });

        // Removes the columns of translated values.
        for (var i: number = 0; i < translated.length; i++) {

            var index: number = matches.indexOf(translated[i], 0);
            if (index > -1) {
                matches.splice(index, 1);
            }

        }

        return matches;

    }

    /**
     * Matches a string into an array of objects or an array of arrays.
     * 
     * @param s The string to search
     * @param list The array to look for
     * @param keyNames An array that contains the columns to look for
     * @param options
     * @return An observable for each element of the filtered list or the same list if Intl.Collator is not supported
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Collator
     */
    public searchAsync(s: string, list: Array<any>, keyNames: any[], options: any = { usage: 'search' }): Observable<any> {

        if (list == null) { return null; }

        if (keyNames == null || s == "" || IntlSupport.Collator(this.locale.getCurrentLanguage()) == false) {

            return new Observable<any>((observer: Observer<any>) => {

                for (let item of list) {

                    observer.next(item);

                }

                observer.complete();

            });

        }

        return new Observable<any>((observer: Observer<any>) => {

            // Gets the value of translation for the each column.
            var translated: Array<string> = new Array<string>();

            var i: number = 0;
            for (var i: number = 0; i < keyNames.length; i++) {

                // Adds a new column for translated values.
                translated.push(keyNames[i].concat("Translated"));

                for (let item of list) {

                    // Gets the values of translation for the column.
                    var value: string = this.translate(item[keyNames[i]]);
                    // Updates the value in the list.
                    item[translated[i]] = value;

                }

            }

            var locale: string = this.locale.getCurrentLanguage();

            // Intl.Collator.
            var collator: Intl.Collator = new Intl.Collator(locale, options);

            for (let v of list) {

                for (var i: number = 0; i < translated.length; i++) {

                    // Calls matching algorithm.
                    if (this.match(v[translated[i]], s, collator)) {

                        observer.next(v);
                        break;

                    }

                }

            }

            // Removes the columns of translated values.
            for (var i: number = 0; i < translated.length; i++) {

                var index: number = list.indexOf(translated[i], 0);
                if (index > -1) {
                    list.splice(index, 1);
                }

            }

            observer.complete();

        });

    }

    private addExtension(locale: string, extension?: string): string {

        // Adds extension.
        if (extension != null && extension != "") {

            locale = locale + "-" + extension;

        }

        return locale;

    }

    /**
     * Matching algorithm.
     * 
     * @param v The value
     * @param s The string to search
     * return True if match, otherwise false
     */
    private match(v: string, s: string, collator: Intl.Collator): boolean {

        var vLength: number = v.length;
        var sLength: number = s.length;

        if (sLength > vLength) { return false; } // The search string is longer than value.

        if (sLength == vLength) {

            return collator.compare(v, s) === 0;

        }

        // Tries to search the substring.
        var found: boolean = false;
        for (var i: number = 0; i < vLength - (sLength - 1); i++) {

            var str: string = v.substr(i, sLength);
            if (collator.compare(str, s) === 0) {

                found = true;
                break;

            }

        }

        return found;

    }

    /**
     * Asynchronous loading: gets translation data.
     */
    private getTranslation(language: string): void {

        // Initializes the translation data & the service state.
        this.translationData = {};
        this.serviceState = ServiceState.isLoading;

        // Gets translation data for all providers.
        this.counter = this.providers.length;

        for (let provider of this.providers) {

            // Builds the URL.
            var url: string = provider.prefix;

            if (provider.webAPI == true) {

                // Absolute URL for Web API.
                url += language;

            } else {

                // Relative server path for 'json' files.
                url += language + "." + provider.dataFormat;

            }

            // Angular 2 Http module.
            this.http.get(url)
                .map((res: Response) => res.json())
                .subscribe(

                // Observer or next.
                (res: any) => {

                    // Adds response to the translation data.
                    this.addData(res, language);

                },

                // Error.
                (error: any) => {

                    console.error("Localization service:", error);

                },

                // Complete.
                () => {

                    this.counter--;

                    // Checks for the last one request.
                    if (this.counter <= 0) {

                        this.translationComplete(language);

                    }

                });

        }

    }

    /**
     * Adds or extends translation data.
     */
    private addData(data: any, language: string): void {

        this.translationData[language] = (typeof this.translationData[language] != "undefined") ? this.extend(this.translationData[language], data) : data;

    }

    /**
     * Merges two translation data.
     */
    private extend(...args: Array<any>): any {

        const newObj: any = {};

        for (let obj of args) {
            for (let key in obj) {

                // Copies all the fields.
                newObj[key] = obj[key];

            }
        }

        return newObj;

    }

    private translationComplete(language: string): void {

        // Updates the service state.
        this.serviceState = ServiceState.isReady;

        // Updates the language code of the service: all the translate pipe will invoke the trasform method.
        this.languageCode = language;

        // Sends an event for the components.
        this.translationChanged.emit(language);

    }

}

/**
 * Defines the provider for asynchronous loading of the translation data.
 */
class Provider {

    prefix: string;

    dataFormat: string;

    webAPI: boolean;

}

/**
 * Defines the service state.
 */
export enum ServiceState {

    /**
     * The translation data has been loaded.
     */
    isReady,
    /**
     * The service is loading the data.
     */
    isLoading,
    /**
     * The service is waiting for the data.
     */
    isWaiting

}

/**
 * Defines the loading mode.
 */
export enum LoadingMode {

    /**
     * Direct loading.
     */
    Direct,
    /**
     * Asynchronous loading.
     */
    Async

}
