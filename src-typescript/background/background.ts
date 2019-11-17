let portToWebpage: chrome.runtime.Port;
const seven_days_in_seconds: number = 604800;
let cached_data: TradeDataMap = {};

function enableExtensionDropdown() {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
        chrome.declarativeContent.onPageChanged.addRules([
            {
                conditions: [
                    new chrome.declarativeContent.PageStateMatcher({
                        pageUrl: {
                            hostEquals: "www.tradingview.com",
                            pathContains: "chart",
                            schemes: ["https"]
                        }
                    })
                ],
                actions: [new chrome.declarativeContent.ShowPageAction()]
            }
        ]);
    });
}

function getMessageFromExtension() {
    interface RequestObject {
        readonly type: string;
        readonly name?: string;
        readonly timewindow?: number;
        readonly _index: string;
    }
    interface ResponseObject {
        extension_id: string;
    }
    function onMessageReceived(
        request: RequestObject,
        sender: any,
        sendResponse: (response_object: ResponseObject) => void
    ): void {
        switch (request.type) {
            case "timewindow":
                console.log("change time window");
                portToWebpage.postMessage({
                    type: "timewindow",
                    timewindow: request.timewindow
                });
                break;
            case "update_from_popup":
                console.log("update_from_popup received");
                portToWebpage.postMessage({
                    type: "update_from_popup",
                    timewindow: request.timewindow,
                    _index: request._index
                });
                break;
            case "extension_id": {
                console.log(sender);
                if (request.name === "helloJS") {
                    let extensionId: string = window.location.host;
                    let response_object: ResponseObject = {
                        extension_id: extensionId
                    };
                    sendResponse(response_object);
                }
                break;
            }
            default:
                break;
        }
        console.log(request);
        console.log(sender);
    }
    chrome.runtime.onMessage.addListener(onMessageReceived);
}

//this function will add that data to the chrome sync storage
function setTradeDataChromeSync(
    trade_pair: string,
    elk_queried_timewindow: Timewindow,
    index_queried: string,
    hits: [Hit],
    original_timewindow: Timewindow
) {
    console.log("inside getTradeDataChromeSync");

    function createOrderFromHit(hit: Hit): OrderInterface {
        let orderData = hit._source.data.order;
        let order: OrderInterface = {
            timestamp: new Date(hit._source["@timestamp"]).getTime() / 1000,
            entry_filled:
                new Date(orderData.timeline.entry_filled).getTime() / 1000,
            entry_completed:
                new Date(orderData.timeline.completed).getTime() / 1000,
            actual_price: orderData.entry.actual_price,
            actual_price_exit: orderData.exit.actual_price,
            stop_loss: orderData.stop_loss_limit,
            target_price: orderData.exit.target_price,
            direction: orderData.direction,
            profit_net_usd: orderData.profit_net_usd,
            quantity_filled: orderData.entry.quantity_filled,
            reward_percent: orderData.reward_percent,
            risk_percent: orderData.risk_percent,
            risk_reward_ratio: orderData.risk_reward_ratio,
            state: orderData.state,
            strategy: orderData.strategy,
            trailer_percent: orderData.trailer_percent,
            trailer_price: orderData.trailer_price,
            highest_target_percent: orderData.highest_target_percent,
            highest_market_percent: orderData.highest_market_percent,
            lowest_target_percent: orderData.lowest_target_percent,
            lowest_market_percent: orderData.lowest_market_percent,
            estimated_fee_total_in_usd: orderData.estimated_fee_total_in_usd,
            fee_total_in_usd: orderData.fee_total_in_usd,
            estimated_profit_net: orderData.estimated_profit_net,
            estimated_profit_gross: orderData.estimated_profit_gross,
            estimated_loss_net: orderData.estimated_loss_net,
            estimated_loss_gross: orderData.estimated_loss_gross,
            _id: orderData.id
        };

        return order;
    }

    /*
    repackage hits into a Orders_Map where the key is the orderId of the order
    and the key-value pairs in each order are only those which are needed
    e.g.
      trade_data_BTCUSDT-gammat_prod_01d:{
        9e141bf7-cc8f-4678-abd2-13fb55bbaa20:{
          entry_filled:<some date stamp>,
          entry_completed:<another date stamp>,
          ....
        },
          ....
      }
    e.g. end
    */
    function generateOrdersMap(hits: [Hit]): OrdersMap {
        let orders_map: OrdersMap = {};
        let orders_array: OrderInterface[] = [];
        hits.forEach((hit) => {
            let order = createOrderFromHit(hit);
            orders_array.push(order);
        });
        orders_array.sort(function(a, b) {
            return b.entry_filled - a.entry_filled;
        });
        orders_array.forEach((order) => {
            let orderId = order._id;
            orders_map = {
                ...orders_map,
                [orderId]: order
            };
        });
        return orders_map;
    }

    function defineNewTimewindowAndOrders(
        orders_map: OrdersMap,
        elk_queried_timewindow: Timewindow
    ): { new_orders: OrdersMap; new_timewindow: Timewindow } {
        function constructRawOrdersMapAndTimewindow(
            stored_timewindow: Timewindow,
            stored_orders: OrdersMap,
            elk_queried_timewindow: Timewindow,
            orders_map: OrdersMap
        ): {
            new_timewindow: Timewindow;
            new_orders: OrdersMap;
            past_future: string;
        } {
            let new_timewindow = elk_queried_timewindow;
            let new_orders = orders_map;
            let past_future = "none";

            if (elk_queried_timewindow.from === stored_timewindow.to + 1) {
                //query is for a future portion adjacent to
                //stored_timewindow
                new_timewindow.to = elk_queried_timewindow.to;
                new_timewindow.from = stored_timewindow.from;
                new_orders = {
                    ...stored_orders,
                    ...orders_map
                };
                past_future = "future";
                console.log(
                    "elk query is in the future of stored and adjacent"
                );
            } else if (
                elk_queried_timewindow.to ===
                stored_timewindow.from - 1
            ) {
                //query is for a past portion adjacent to
                //stored_timewindow
                new_timewindow.to = stored_timewindow.to;
                new_timewindow.from = elk_queried_timewindow.from;
                new_orders = {
                    ...orders_map,
                    ...stored_orders
                };
                past_future = "past";
                console.log("elk query is in the past of stored and adjacent");
            } else {
                console.log(
                    "unhandled condition at setTradeDataChromeSync for setting time window"
                );
            }

            return {
                new_timewindow: new_timewindow,
                new_orders: new_orders,
                past_future: past_future
            };
        }

        function trimCacheOfOldOrders(
            new_timewindow: Timewindow,
            new_orders: OrdersMap,
            past_future: string
        ): {
            new_timewindow: Timewindow;
            new_orders: OrdersMap;
        } {
            if (
                new_timewindow.to - new_timewindow.from >
                seven_days_in_seconds * 2
            ) {
                //currently defined new_timewindow is more than 2 weeks
                //remove data older than 2 weeks

                for (const order_id in new_orders) {
                    const order = new_orders[order_id];
                    const timestamp = order.timestamp;

                    if (
                        past_future === "future" &&
                        timestamp <
                            new_timewindow.to - seven_days_in_seconds * 2
                    ) {
                        //query is for a future portion, hence queries to be released from
                        //cache are in the past portion

                        console.log("deleting cache in past portion");
                        //timestamp of order is found to be 2 weeks old from current query,
                        //delete order
                        delete new_orders[order_id];
                        //modify new_timewindow to reflect that it no longer
                        //encompasses the older orders
                        new_timewindow.from =
                            new_timewindow.to - seven_days_in_seconds * 2;
                    } else if (
                        past_future === "past" &&
                        timestamp >
                            new_timewindow.from + seven_days_in_seconds * 2
                    ) {
                        //query is for a past portion, hence queries to be released from
                        //cache are in the future portion

                        console.log("deleting cache in future portion");
                        //timestamp of order is found to be 2 weeks old from current query,
                        //delete order
                        delete new_orders[order_id];
                        //modify new_timewindow to reflect that it no longer
                        //encompasses the older orders
                        new_timewindow.to =
                            new_timewindow.from + seven_days_in_seconds * 2;
                    }
                }
            }

            return {
                new_timewindow: new_timewindow,
                new_orders: new_orders
            };
        }

        //delete orders with cancelled state from cache
        function deleteCancelledOrders(new_orders: OrdersMap): OrdersMap {
            for (const order_id in new_orders) {
                const order = new_orders[order_id];
                const state = order.state;

                if (state === "canceled") {
                    delete new_orders[order_id];
                }
            }

            return new_orders;
        }

        let trade_data_stored =
            cached_data["trade_data_" + trade_pair + "-" + index_queried];
        let new_timewindow = elk_queried_timewindow;
        let new_orders = orders_map;

        if (
            trade_data_stored !== undefined &&
            !(
                elk_queried_timewindow.to - elk_queried_timewindow.from ===
                seven_days_in_seconds
            )
        ) {
            //elk queried timewindow is not 7 days, hence we can assume
            //the timewindow of stored and elk_queried will be continuous
            //if joined
            //also based on evaluation of getTradeDataChromeSync
            //elk queried timewindow will be just adjacent to
            //stored_timewindow if they are less than 7 days diff
            let stored_timewindow = trade_data_stored.timewindow;
            let stored_orders = trade_data_stored.orders;
            //define new_timewindow to be stored
            let raw_orders_and_timewindow = constructRawOrdersMapAndTimewindow(
                stored_timewindow,
                stored_orders,
                elk_queried_timewindow,
                orders_map
            );
            let trimmed_orders_and_timewindow = trimCacheOfOldOrders(
                raw_orders_and_timewindow.new_timewindow,
                raw_orders_and_timewindow.new_orders,
                raw_orders_and_timewindow.past_future
            );
            new_orders = deleteCancelledOrders(
                trimmed_orders_and_timewindow.new_orders
            );
            new_timewindow = trimmed_orders_and_timewindow.new_timewindow;
            console.log("trimmed new_orders");
        } else {
            console.log(trade_data_stored);
            console.log(
                elk_queried_timewindow.to - elk_queried_timewindow.from
            );
            console.log(
                "elk query is detached from stored or stored is less than 7 days or trade_data_stored is undefined"
            );
            new_orders = deleteCancelledOrders(new_orders);
        }

        return { new_orders: new_orders, new_timewindow: new_timewindow };
    }

    //since cache has been updated,
    //make a callback to getTradeDataChromeSync with
    //original_timewindow
    function onCacheUpdated() {
        console.log("going back to getTradeDataChromeSync");
        let msg = {
            trade_pair: trade_pair,
            timewindow: original_timewindow,
            _index: index_queried,
            original_timewindow: original_timewindow,
            type: <"trade_pair">"trade_pair"
        };
        getTradeDataChromeSync(msg);
    }

    let orders_map = generateOrdersMap(hits);

    let new_orders_timewindow = defineNewTimewindowAndOrders(
        orders_map,
        elk_queried_timewindow
    );

    cached_data["trade_data_" + trade_pair + "-" + index_queried] = {
        orders: new_orders_timewindow.new_orders,
        timewindow: new_orders_timewindow.new_timewindow
    };
    onCacheUpdated();
    setLocalCache(cached_data);

    console.log("exiting setTradeDataChromeSync");
}

function getTradeDataChromeSync(msg: MessageTradePair) {
    let trade_pair = msg.trade_pair;
    let timewindow = msg.timewindow;
    let _index = msg._index;
    //retrieve data presently stored in chrome sync
    let trade_data = cached_data["trade_data_" + trade_pair + "-" + _index];

    if (trade_data === undefined) {
        //data for this trade not found OR
        //trade_data found is less than 7 days
        //make elk query for 7 days
        msg.timewindow.from = msg.timewindow.to - seven_days_in_seconds;
        console.log("no data found for this trade_pair and _index");
        console.log("making elk query for past 7 days");
        getTradePairDataELK(msg);
    } else if (
        trade_data.timewindow.to - trade_data.timewindow.from <
        seven_days_in_seconds
    ) {
        msg.timewindow.from = msg.timewindow.to - seven_days_in_seconds;
        console.log("data for this trade_pair is less than 7 days worth");
        console.log("making elk query for past 7 days");
        getTradePairDataELK(msg);
    } else {
        //data for this trade found, check to see if queried
        //timewindow is within range of cached data
        let stored_timewindow = trade_data.timewindow;

        if (
            stored_timewindow.from <= timewindow.from &&
            stored_timewindow.to >= timewindow.to
        ) {
            //queried time_window is within stored time_window
            //continue to pull data from stored data
            let orders = trade_data.orders;
            let orders_result = [];

            for (const order_id in orders) {
                //check each order's timestamp if it is within the
                //timewindow.
                //timestamp in timewindow and order are in seconds
                const order = orders[order_id];
                let orderTimestampWithinTimewindow =
                    order.timestamp <= timewindow.to &&
                    order.timestamp >= timewindow.from;
                let orderIsBeforeTimewindowButUncompleted =
                    order.entry_filled < timewindow.from &&
                    (order.entry_completed === null ||
                        order.entry_completed === 0 ||
                        order.entry_completed === undefined);
                let orderCompletedAndEntryBeforeTimewindowTo =
                    order.entry_filled < timewindow.to &&
                    order.entry_completed > timewindow.to;

                if (
                    orderTimestampWithinTimewindow ||
                    orderIsBeforeTimewindowButUncompleted ||
                    orderCompletedAndEntryBeforeTimewindowTo
                ) {
                    //order is within timewindow
                    //add it to the orders_result array
                    orders_result.push(order);
                }
            }
            console.log("timewindow within cache, sending data to webpage");
            console.log(orders_result);
            //lastly, send result to webpage
            portToWebpage.postMessage({
                type: "trade_data",
                trade_data: orders_result
            });
        } else if (stored_timewindow.to < timewindow.to) {
            //queried timewindow is in the "future"
            //make an elk query to fill up that gap

            if (timewindow.to - seven_days_in_seconds > stored_timewindow.to) {
                //if there is a gap of more than 7 days, stick
                //query to 7 days
                msg.timewindow.from = msg.timewindow.to - seven_days_in_seconds;
                console.log(
                    "query extends to more than 7 days after current cache"
                );
                console.log("making elk query for past 7 days");
                getTradePairDataELK(msg);
            } else {
                //gap is not more than 7 days, fill up gap
                msg.timewindow.from = stored_timewindow.to + 1;
                console.log(
                    "making elk query from " +
                        new Date(msg.timewindow.from * 1000).toUTCString() +
                        " to " +
                        new Date(msg.timewindow.to * 1000).toUTCString()
                );
                getTradePairDataELK(msg);
            }
        } else if (stored_timewindow.from > timewindow.from) {
            //queried timewindow is in the "past"
            //make an elk query to fill up the gap

            if (
                timewindow.from + seven_days_in_seconds <
                stored_timewindow.from
            ) {
                //query extends to more than 7 days into the past, stick
                //query to 7 days
                msg.timewindow.from = msg.timewindow.to - seven_days_in_seconds;
                console.log(
                    "query extends to more than 7 days before current cache"
                );
                console.log("making elk query for past 7 days");
                getTradePairDataELK(msg);
            } else {
                //query does not extend to more than 7 days into the past
                //from current cache
                msg.timewindow.to = stored_timewindow.from - 1;
                console.log(
                    "making elk query from " +
                        new Date(msg.timewindow.from * 1000).toUTCString() +
                        " to " +
                        new Date(msg.timewindow.to * 1000).toUTCString()
                );
                getTradePairDataELK(msg);
            }
        }
    }
}

function getTradePairDataELK(msg: MessageTradePair) {
    let requestObject = {
        version: true,
        size: 500,
        sort: [
            {
                "@timestamp": {
                    order: "asc"
                }
            }
        ],
        _source: {
            excludes: []
        },
        stored_fields: ["*"],
        script_fields: {},
        docvalue_fields: [],
        query: {
            bool: {
                must: [
                    {
                        query_string: {
                            query:
                                msg.trade_pair +
                                " && (data.order.direction:long || data.order.direction:short)" +
                                " && @timestamp:[" +
                                msg.timewindow.from * 1000 +
                                " TO " +
                                msg.timewindow.to * 1000 +
                                "]",
                            analyze_wildcard: true,
                            default_field: "*"
                        }
                    },
                    {
                        match_phrase: {
                            _index: {
                                query: msg._index
                            }
                        }
                    }
                ],
                filter: [],
                should: [],
                must_not: [
                    {
                        match_phrase: {
                            _index: {
                                query: "gammat_dev"
                            }
                        }
                    }
                ]
            }
        },
        highlight: {
            pre_tags: ["@kibana-highlighted-field@"],
            post_tags: ["@/kibana-highlighted-field@"],
            fields: {
                "*": {}
            },
            fragment_size: 2147483647
        }
    };
    console.log("at condition make_es_call");
    let url: string = "https://gammat-elk.diz:9200/_search";
    // + encodeURIComponent(request.itemId);
    // console.log(requestObject);
    fetch(url, {
        body: JSON.stringify(requestObject),
        headers: {
            Authorization: "Basic YWRtaW46YWRtaW4=",
            "Content-Type": "application/json"
        },
        // query: JSON.stringify(requestObject),
        method: "POST"
    })
        .then((response) => {
            console.log(response);
            let jsonResponse = response.json().then((data) => ({
                data: data,
                status: response.status
            }));

            return jsonResponse;
        })
        .then((res) => {
            console.log(res.status, res.data);
            console.log("sending 'trade_positions'");
            // //send data back to webpage
            // portToWebpage.postMessage({
            //     type: "trade_positions",
            //     positions: res.data
            // });
            // if (res.data.hits.hits.length !== 0) {
            console.log("hits length: " + res.data.hits.hits.length);
            setTradeDataChromeSync(
                msg.trade_pair,
                msg.timewindow,
                msg._index,
                res.data.hits.hits,
                msg.original_timewindow
            );
            // } else {
            //     setTradeDataChromeSync(
            //         msg.trade_pair,
            //         msg.time_window,
            //         msg._index,
            //         res.data.hits.hits,
            //         msg.original_time_window
            //     );
            //     // portToWebpage.postMessage({
            //     //     type: "error",
            //     //     error: "no hits received at this query"
            //     // });
            // }
        })
        .catch((error) => console.log(error));
}

function setLocalCache(cached_data: TradeDataMap) {
    chrome.storage.local.set({ trade_data_map_cache: cached_data });
}

function getLocalCache() {
    chrome.storage.local.get(["trade_data_map_cache"], function(result) {
        if (result.trade_data_map_cache !== undefined) {
            cached_data = <TradeDataMap>result.trade_data_map_cache;
        }
    });
}

getLocalCache();
chrome.runtime.onConnectExternal.addListener(function(port) {
    portToWebpage = port;
    portToWebpage.onMessage.addListener(function(msg) {
        if (portToWebpage.name === "webpage-background") {
            //do webpage things

            switch (msg.type) {
                case "trade_pair":
                    console.log(msg);
                    //store the originally queried time_window inside the msg object
                    //as the time_window might be manipulated to make an elk query
                    //but the original time_window is required to retrieve data in the end
                    getTradeDataChromeSync(msg);
                    // getTradePairDataELK(msg);
                    break;
                // case "save_chart":
                //     saveChart();
                //     break;
                default:
                    break;
            }
        }
    });
});
function webpageReadyListener() {
    chrome.runtime.onMessageExternal.addListener(function(request) {
        console.log(request);
        if (request.type === "start_inject") {
            chrome.tabs.query({ active: true, currentWindow: true }, function(
                tabs
            ) {
                chrome.tabs.sendMessage(<number>tabs[0].id, {
                    type: "begin_inject"
                });
            });
        }
    });
}
webpageReadyListener();
getMessageFromExtension();
chrome.runtime.onInstalled.addListener(enableExtensionDropdown);
