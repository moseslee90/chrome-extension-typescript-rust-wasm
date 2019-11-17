/// <reference path="../models/order.ts" />

declare var TradingViewApi: any;

function injectMain(
    functionToInject: Function,
    extensionId: string,
    manualTimewindowSeconds: number,
    _index: string
) {
    let injectedIIEF: HTMLScriptElement = document.createElement("script");
    injectedIIEF.appendChild(
        document.createTextNode(
            "(" +
                functionToInject +
                "('" +
                extensionId +
                "', " +
                manualTimewindowSeconds +
                ", '" +
                _index +
                "', " +
                classes.Order +
                "));"
        )
    );
    document.body.appendChild(injectedIIEF);
}

function injectOverlayHTML() {
    //inject bootstrap
    let bootstrapCss = document.createElement("link");
    bootstrapCss.setAttribute("rel", "stylesheet");
    bootstrapCss.setAttribute(
        "href",
        "https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css"
    );
    bootstrapCss.setAttribute(
        "integrity",
        "sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T"
    );
    bootstrapCss.setAttribute("crossorigin", "anonymous");
    document.head.appendChild(bootstrapCss);
    //bootstrap spinner
    let spinner = document.createElement("div");
    spinner.setAttribute("id", "overlay-spinner");
    spinner.classList.add("spinner-border");
    spinner.setAttribute("style", "width: 3rem; height: 3rem;");
    spinner.setAttribute("role", "status");
    let spinnerSpan = document.createElement("span");
    spinnerSpan.classList.add("sr-only");
    spinnerSpan.innerText = "Loading...";
    spinner.appendChild(spinnerSpan);
    //inject style
    let style = document.createElement("style");
    style.innerText = `#overlay {
        position: fixed;
        display: none;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0,0,0,0.5);
        z-index: 2;
        cursor: pointer;
        }    
        #overlay-spinner{
          position: absolute;
          top: 50%;
          left: 50%;
          color: white;
        }`;
    document.head.appendChild(style);
    //then inject html into body
    let overlayDiv = document.createElement("div");
    overlayDiv.setAttribute("id", "overlay");
    overlayDiv.appendChild(spinner);
    let chartAreaElement = <Element>(
        document.querySelector("td.chart-markup-table.pane")
    );
    chartAreaElement.appendChild(overlayDiv);
}

function requestContext() {
    //first check chartId and popup time window state
    chrome.storage.sync.get(
        {
            chartId: "",
            chartIdSet: false,
            total_seconds: -1,
            _index: "gammat_prod_01d"
        },
        function(items) {
            //check chart id
            let pageChartId: string = window.location.pathname.split("/")[2];

            if (
                (items.chartIdSet && items.chartId === pageChartId) ||
                !items.chartIdSet
            ) {
                //get extension id
                chrome.runtime.sendMessage(
                    { type: "extension_id", name: "helloJS" },
                    (response) => {
                        injectMain(
                            main,
                            response.extension_id,
                            items.total_seconds,
                            items._index
                        );
                        console.log(response.extension_id);
                    }
                );
            } else {
                console.log(
                    "page chart Id does not match chart Id set in options"
                );
            }
        }
    );
}

function main(
    extensionId: string,
    manualTimewindowSeconds: number,
    _index: string,
    Order: any
) {
    let shapesGroupMap: ShapesGroupMap = {};

    /**
     * getTimeResolutionInSeconds -
     * 1. Gets time resolution which corresponds to the amount of time in seconds each
     *    candle currently represents in the chart
     */
    function getTimeResolutionInSeconds(): number {
        let time_resolution: string = TradingViewApi.chart().resolution();
        let smallestTimeUnitInSeconds = 60;
        let isTimeResolutionDay: boolean =
            time_resolution.split("D").length > 1;
        if (isTimeResolutionDay) {
            smallestTimeUnitInSeconds =
                parseInt(time_resolution.split("D")[0]) * 86400;
        } else {
            smallestTimeUnitInSeconds = parseInt(time_resolution) * 60;
        }
        return smallestTimeUnitInSeconds;
    }

    /**
     * checkForShapeRenderError -
     * 1. Gets log of shapes drawn in shapesDrawnArray
     * 2. Scans entries which have the toolname "LineToolDateAndPriceRange"
     * 3. gets the timePoint pair of that entry
     * 4. Checks if the timePoint pairs are equal to each other, which would
     *    denote that the shape could be incorrectly rendered (stacked on top of itself)
     * 5. Compare shape drawn entry and exit points to the what was intended to be drawn based on
     *    record from shapesGroupMap by using shapeID to find the corresponding record.
     * 6. If the shape is found to have entry and exit points too far from what is intended
     *    (an error within one candle is allowed) the shape is determined to be rendered incorrectly
     */
    function checkForShapeRenderError() {
        let shapesDrawnArray = TradingViewApi.chart()
            ._chartWidget.model()
            .model()
            .allLineTools();
        for (let i = shapesDrawnArray.length - 1; i >= 0; i--) {
            const shapeDrawn = shapesDrawnArray[i];
            const shapeType: string = shapeDrawn.toolname;
            if (shapeType === "LineToolDateAndPriceRange") {
                const timePoints = shapeDrawn._timePoint;
                const shapeId = shapeDrawn._id;
                const time1 = timePoints[0].time_t;
                const time2 = timePoints[1].time_t;
                if (
                    time1 === time2 &&
                    shapesGroupMap[shapeId] !== undefined &&
                    time1 !== undefined &&
                    time2 !== undefined
                ) {
                    //use time_resolution to determine accuracy of shape drawn
                    let timeResolutionInSeconds: number = getTimeResolutionInSeconds();

                    let shapeFromMemory = shapesGroupMap[shapeId];
                    let entryFromMemory = shapeFromMemory.entry;
                    let exitFromMemory = shapeFromMemory.exit;

                    let entryDiff = Math.abs(time1 - entryFromMemory);
                    let exitDiff = Math.abs(time2 - exitFromMemory);

                    let timeDiffGreaterThanOneCandle: boolean =
                        entryDiff > timeResolutionInSeconds ||
                        exitDiff > timeResolutionInSeconds;
                    if (timeDiffGreaterThanOneCandle) {
                        console.warn("error found at shape: " + shapeId);
                        console.warn("time1: " + time1);
                        console.warn("time2: " + time2);
                        console.warn(shapesGroupMap[shapeId]);
                    }
                }
            }
        }
    }

    let queryAfterTimeout: ReturnType<typeof setTimeout>;
    let portToBackground: chrome.runtime.Port = chrome.runtime.connect(
        extensionId,
        {
            name: "webpage-background"
        }
    );
    //keep track of current time window
    //data is stored in secs, not ms
    let current_timewindow: Timewindow = { to: 0, from: 0 };

    function connectPortToBackgroundPage() {
        portToBackground.onMessage.addListener(backgroundMessageListener);
    }
    connectPortToBackgroundPage();

    function getCurrentTradingPair(timewindow: Timewindow) {
        console.log("hello from injected IIEF");
        //get current trade pair from TW api
        let currentTradePair: string = TradingViewApi.chart().symbolExt()
            .symbol;
        console.log(currentTradePair);
        //update current time window before query is sent
        current_timewindow = timewindow;
        console.log(current_timewindow);
        console.log(_index);
        let msg: MessageTradePair = {
            type: "trade_pair",
            trade_pair: currentTradePair,
            timewindow: timewindow,
            _index: _index,
            original_timewindow: timewindow
        };
        portToBackground.postMessage(msg);
    }

    function backgroundMessageListener(
        msg:
            | MessageTimewindow
            | MessageUpdateFromPopup
            | MessageTradeData
            | MessageError
    ) {
        switch (msg.type) {
            case "timewindow":
                console.log("time window changed to: " + msg.timewindow);
                manualTimewindowSeconds = msg.timewindow;
                getTradeDataForTimeWindow(
                    TradingViewApi.chart().getVisibleRange()
                );
                break;
            case "update_from_popup":
                manualTimewindowSeconds = msg.timewindow;
                _index = msg._index;
                console.log(_index);
                getTradeDataForTimeWindow(
                    TradingViewApi.chart().getVisibleRange()
                );
                break;
            case "trade_data":
                console.log("receiving trade_data from cache");
                console.log(msg.trade_data);
                renderTradeObjectsCached(msg.trade_data);
                break;
            case "error":
                console.log(msg.error);
                break;
            default:
                break;
        }
    }

    //function declaration for creating date_and_price_range objects
    //function also stores Ids into a hashmap which will be written
    //into localStorage at the end
    function createDatePriceRangePair(
        orderId: string,
        datePriceRangeTarget: DatePriceRangeShape,
        datePriceRangeStop: DatePriceRangeShape,
        noteEntry: NoteShape,
        noteExit: NoteShape,
        orderCompletedStatus: boolean,
        hashmap: ShapeIdMap
    ) {
        let targetId = TradingViewApi.chart().createMultipointShape(
            datePriceRangeTarget.points,
            datePriceRangeTarget.options
        );
        let stopId = TradingViewApi.chart().createMultipointShape(
            datePriceRangeStop.points,
            datePriceRangeStop.options
        );
        let orderIdTarget = orderId + "-target";
        let orderIdStop = orderId + "-stop";
        hashmap.shapesToOrdersMap[targetId] = orderId;
        hashmap.shapesToOrdersMap[stopId] = orderId;
        hashmap.ordersToShapesMap[orderIdTarget] = targetId;
        hashmap.ordersToShapesMap[orderIdStop] = stopId;
        //note object
        let noteId = TradingViewApi.chart().createMultipointShape(
            noteEntry.points,
            noteEntry.options
        );
        let orderIdNote = orderId + "-note";
        hashmap.shapesToOrdersMap[noteId] = orderId;
        hashmap.ordersToShapesMap[orderIdNote] = noteId;

        let noteCompletedId = "";

        //if order is completed, a note object is generated at the point of exit
        if (orderCompletedStatus === true) {
            let noteCompletedId = TradingViewApi.chart().createMultipointShape(
                noteExit.points,
                noteExit.options
            );
            let orderIdNoteCompleted = orderId + "-noteCompleted";
            hashmap.shapesToOrdersMap[noteCompletedId] = orderId;
            hashmap.ordersToShapesMap[orderIdNoteCompleted] = noteCompletedId;
        }

        let orderShapesIds: OrderShapesIds = {
            targetId: targetId,
            stopId: stopId,
            noteId: noteId,
            noteCompletedId: noteCompletedId
        };

        let entryTime = datePriceRangeTarget.points[0].time;
        let exitTime = datePriceRangeTarget.points[1].time;

        shapesGroupMap[targetId] = {
            orderShapeIds: orderShapesIds,
            entry: entryTime,
            exit: exitTime
        };

        return hashmap;
    }

    //function declaraction to write maps into localStorage
    function writeMapsToLocalStorage(hashmap: ShapeIdMap) {
        let tradePair: string = TradingViewApi.chart().symbolExt().symbol;
        let tradePairMap: ShapeIdMap = {
            shapesToOrdersMap: hashmap.shapesToOrdersMap,
            ordersToShapesMap: hashmap.ordersToShapesMap
        };
        window.localStorage.setItem(
            "trade_bot_data-" + tradePair,
            JSON.stringify(tradePairMap)
        );
    }

    //function declaration to remove old shapes if shapesToOrdersMap
    //is found in localStorage
    function removeOldShapes() {
        let tradePair: string = TradingViewApi.chart().symbolExt().symbol;
        let mapString: string | null = window.localStorage.getItem(
            "trade_bot_data-" + tradePair
        );

        if (mapString !== null) {
            let map: ShapeIdMap = JSON.parse(mapString);
            let shapesToOrdersMap = map.shapesToOrdersMap;

            for (let shapeId in shapesToOrdersMap) {
                TradingViewApi.chart().removeEntity(shapeId);
            }
        }
    }
    function renderTradeObjectsCached(ordersArray: [OrderInterface]) {
        removeOldShapes();
        //hashmap declaration
        let hashmap: ShapeIdMap = {
            shapesToOrdersMap: {},
            ordersToShapesMap: {}
        };
        shapesGroupMap = {};

        let earliestEntry = current_timewindow.to;

        ordersArray.forEach((orderObject) => {
            let order = <classes.Order>(
                new Order(orderObject, current_timewindow, earliestEntry)
            );
            let entry = orderObject.entry_filled;
            if (entry < earliestEntry) {
                earliestEntry = entry;
            }
            // //date_and_price_range object for profit range
            // prettier-ignore
            let datePriceRangeTarget: DatePriceRangeShape = order.datePriceRangeObject("target");
            // //date_and_price_range object for stoploss range
            // prettier-ignore
            let datePriceRangeStop: DatePriceRangeShape = order.datePriceRangeObject("stop");
            // //note object
            let noteEntry: NoteShape = order.noteObject("entry");
            //note object to be used if order is completed
            let noteExit: NoteShape = order.noteObject("exit");
            //declare orderId
            let orderId = order._id;

            hashmap = createDatePriceRangePair(
                orderId,
                datePriceRangeTarget,
                datePriceRangeStop,
                noteEntry,
                noteExit,
                order.orderCompletedStatus,
                hashmap
            );
        });
        checkForShapeRenderError();
        writeMapsToLocalStorage(hashmap);
        TradingViewApi.saveChartToServer();
        overlayOff();
    }

    function getTradeDataForTimeWindow(range: Timewindow) {
        const presentTime = Date.now() / 1000;

        //ensure range.to is not beyond present time
        if (range.to > presentTime) {
            range.to = presentTime;
        }
        // let range = TradingViewApi.chart().getVisibleRange();
        let time_from_limit = 0;
        //getVisibleRange() has a limit that changes with the
        //time resolution of the chart.
        //time_from_limit gets that limit
        let time_resolution: string = TradingViewApi.chart().resolution();

        if (manualTimewindowSeconds === -1) {
            //if a manual time window is not specified, use the auto range
            //for each time resolution
            switch (time_resolution) {
                //time durations have been modified slightly from absolute amount
                //that the variable name implies
                case "1":
                    let five_hours = 17940;
                    time_from_limit = Date.now() / 1000 - five_hours;
                    break;
                case "3":
                    let fifteen_hours = 53820;
                    time_from_limit = Date.now() / 1000 - fifteen_hours;
                    break;
                case "5":
                    let twenty_five_hours = 89700;
                    time_from_limit = Date.now() / 1000 - twenty_five_hours;
                    break;

                default:
                    break;
            }
        } else {
            //use time window with range specified by manualTimeWindow till right
            //most part of chart
            range.from = range.to - manualTimewindowSeconds;
            time_from_limit = range.from - 1;
        }

        clearTimeout(queryAfterTimeout);
        queryAfterTimeout = setTimeout(() => {
            let current_range = TradingViewApi.chart().getVisibleRange();

            //ensure that current_range.to does not go beyond present time as well
            if (current_range.to > presentTime) {
                current_range.to = presentTime;
            }

            //overwrite current_range.from if manualTimeWindow is defined
            if (manualTimewindowSeconds !== -1) {
                current_range.from = current_range.to - manualTimewindowSeconds;
            } else if (range.from < time_from_limit) {
                //if manual time window is not defined and visible range is outside
                //of auto detectable range, set to default 1 day
                console.log(
                    "outside of detectable range, defaulting search range to 1 day"
                );
                let default_time = 86400;
                current_range.from = current_range.to - default_time;
                range.from = range.to - default_time;
            }

            if (
                current_range.from === range.from &&
                current_range.to === range.to
            ) {
                overlayOn();
                console.log("no change in range after 4 seconds");
                console.log("getting data for timestamp: ");
                console.log(new Date(current_range.from * 1000).toUTCString());
                console.log(new Date(current_range.to * 1000).toUTCString());
                getCurrentTradingPair(current_range);
            } else {
                console.log("range changed");
            }
        }, 100);
    }

    //subsciption to get visible range so that when user has changed resolution and
    //stayed at that resolution for more than 4 seconds
    //the method to pull data from ELK will be called and new objects will be drawn.
    function getTradeDataOnTimeWindowChanged() {
        TradingViewApi.chart()
            .onVisibleRangeChanged()
            .subscribe(null, getTradeDataForTimeWindow);
    }
    function getTradeDataOnTradePairChanged() {
        TradingViewApi.chart()
            .onSymbolChanged()
            .subscribe(null, getTradeDataForTimeWindow);
    }

    function overlayOn() {
        if (document.getElementById("overlay") !== null) {
            (<HTMLDivElement>document.getElementById("overlay")).style.display =
                "block";
        }
    }
    function overlayOff() {
        if (document.getElementById("overlay") !== null) {
            (<HTMLDivElement>document.getElementById("overlay")).style.display =
                "none";
        }
    }

    //get contextual data and send it to background.js
    getTradeDataForTimeWindow(TradingViewApi.chart().getVisibleRange());
    setTimeout(() => {
        getTradeDataOnTradePairChanged();
        getTradeDataOnTimeWindowChanged();
    }, 2000);
}

function startContent(extensionId: string) {
    let originalConsoleLog = console.log;

    function loadOnChartLoadLog(msg: string) {
        let logOutput = msg;
        let splitString = [""];
        if (typeof msg === "string") {
            splitString = logOutput.split("ChartApi.Core:Start");
        }
        if (splitString.length === 2) {
            chrome.runtime.sendMessage(extensionId, {
                type: "start_inject",
                name: ""
            });
            console.warn("chart loaded");
            console.log = originalConsoleLog;
        }
        console.warn(msg);
    }

    console.log = loadOnChartLoadLog;
}

function injectOnChartLoad(functionToInject: Function, extensionId: string) {
    let injectedIIEF: HTMLScriptElement = document.createElement("script");
    injectedIIEF.appendChild(
        document.createTextNode(
            "(" + functionToInject + "('" + extensionId + "'));"
        )
    );
    document.body.appendChild(injectedIIEF);
}

chrome.runtime.sendMessage(
    { type: "extension_id", name: "helloJS" },
    (response) => {
        injectOnChartLoad(startContent, response.extension_id);
        console.log(response.extension_id);
    }
);

chrome.runtime.onMessage.addListener((msg) => {
    console.log(msg);
    if (msg.type === "begin_inject") {
        injectOverlayHTML();
        requestContext();
        console.log("msg received from webpage");
    }
});
