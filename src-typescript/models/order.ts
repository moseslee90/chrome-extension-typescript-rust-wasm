interface OrderInterface {
    _id: string;
    actual_price: number;
    actual_price_exit: number;
    direction: string;
    entry_filled: number;
    entry_completed: number;
    estimated_fee_total_in_usd: number;
    estimated_loss_net: number;
    estimated_loss_gross: number;
    estimated_profit_net: number;
    estimated_profit_gross: number;
    fee_total_in_usd: number;
    highest_target_percent: number;
    highest_market_percent: number;
    lowest_target_percent: number;
    lowest_market_percent: number;
    profit_net_usd: number;
    quantity_filled: number;
    reward_percent: number;
    risk_percent: number;
    risk_reward_ratio: number;
    state: string;
    stop_loss: number;
    strategy: string;
    target_price: number;
    timestamp: number;
    trailer_percent: number;
    trailer_price: number;
}

interface OrdersMap {
    [order_id: string]: OrderInterface;
}
namespace classes {
    export class Order implements OrderInterface {
        _id: string;
        actual_price: number;
        actual_price_exit: number;
        direction: string;
        entry_filled: number;
        entry_completed: number;
        estimated_fee_total_in_usd: number;
        estimated_loss_net: number;
        estimated_loss_gross: number;
        estimated_profit_net: number;
        estimated_profit_gross: number;
        fee_total_in_usd: number;
        highest_target_percent: number;
        highest_market_percent: number;
        lowest_target_percent: number;
        lowest_market_percent: number;
        profit_net_usd: number;
        quantity_filled: number;
        reward_percent: number;
        risk_percent: number;
        risk_reward_ratio: number;
        state: string;
        stop_loss: number;
        strategy: string;
        target_price: number;
        timestamp: number;
        trailer_percent: number;
        trailer_price: number;
        //other variables outside of the Order Interface
        errorNote: string;
        errorNoteExit: string;
        noteEntryMarkerColor: string;
        noteCompleteMarkerColor: string;
        trailer_percent_string: string;
        trailer_price_string: string;
        highest_target_percent_string: string;
        highest_market_percent_string: string;
        lowest_target_percent_string: string;
        lowest_market_percent_string: string;
        orderCompletedStatus: boolean;
        //function declarations
        isStopLossTriggered: () => boolean;
        isOrderStateCompleted: () => boolean;
        isOrderCompleted: () => boolean;
        isOrderFilledBeforeTimewindow: (x: Timewindow) => boolean;
        isOrderCompletedAfterTimewindow: (x: Timewindow) => boolean;
        checkStopLossTriggered: () => void;
        checkOrderStateCompletedOrStopped: () => void;
        checkOrderCompleted: () => void;
        checkOrderFilledBeforeTimewindow: (x: Timewindow) => void;
        checkOrderCompleteAfterTimewindow: (x: Timewindow) => void;
        noteObject: (x: "entry" | "exit") => NoteShape;
        datePriceRangeObject: (x: "target" | "stop") => DatePriceRangeShape;

        constructor(
            order: OrderInterface,
            current_timewindow: Timewindow,
            earliest_entry_filled: number
        ) {
            this._id = order._id;
            this.actual_price = order.actual_price;
            this.actual_price_exit = order.actual_price_exit;
            this.direction = order.direction;
            this.entry_filled = order.entry_filled;
            this.entry_completed = order.entry_completed;
            this.estimated_fee_total_in_usd = order.estimated_fee_total_in_usd;
            this.estimated_loss_net = order.estimated_loss_net;
            this.estimated_loss_gross = order.estimated_loss_gross;
            this.estimated_profit_net = order.estimated_profit_net;
            this.estimated_profit_gross = order.estimated_profit_gross;
            this.fee_total_in_usd = order.fee_total_in_usd;
            this.highest_target_percent = order.highest_target_percent;
            this.highest_market_percent = order.highest_market_percent;
            this.lowest_target_percent = order.lowest_target_percent;
            this.lowest_market_percent = order.lowest_market_percent;
            this.profit_net_usd = order.profit_net_usd;
            this.quantity_filled = order.quantity_filled;
            this.reward_percent = order.reward_percent;
            this.risk_percent = order.risk_percent;
            this.risk_reward_ratio = order.risk_reward_ratio;
            this.state = order.state;
            this.stop_loss = order.stop_loss;
            this.strategy = order.strategy;
            this.target_price = order.target_price;
            this.timestamp = order.timestamp;
            this.trailer_percent = order.trailer_percent;
            this.trailer_price = order.trailer_price;
            //initialise secondary variables
            this.errorNote = "";
            this.errorNoteExit = "";
            this.noteEntryMarkerColor = "#2E4EFF";
            this.noteCompleteMarkerColor = "#80FF33";
            this.trailer_percent_string =
                "Trailer Percent: " + order.trailer_percent + "\n";
            this.trailer_price_string =
                "Trailer Price: " + order.trailer_price + "\n";
            this.highest_target_percent_string =
                "Highest Target Percent: " +
                order.highest_target_percent +
                "\n";
            this.highest_market_percent_string =
                "Highest Market Percent: " +
                order.highest_market_percent +
                "\n";
            this.lowest_target_percent_string =
                "Lowest Target Percent: " + order.lowest_target_percent + "\n";
            this.lowest_market_percent_string =
                "Lowest Market Percent: " + order.lowest_market_percent + "\n";
            this.orderCompletedStatus = true;

            this.isStopLossTriggered = function() {
                return this.state === "stop_loss_triggered";
            };
            this.isOrderStateCompleted = function() {
                return this.state === "completed";
            };
            this.isOrderCompleted = function() {
                return (
                    this.entry_completed !== null &&
                    this.entry_completed !== 0 &&
                    this.entry_completed !== undefined
                );
            };
            this.isOrderFilledBeforeTimewindow = function(
                current_timewindow: Timewindow
            ) {
                return this.entry_filled < current_timewindow.from;
            };
            this.isOrderCompletedAfterTimewindow = function(
                current_timewindow: Timewindow
            ) {
                return this.entry_completed > current_timewindow.to;
            };

            this.checkStopLossTriggered = function() {
                //change note complete marker color to red to represent stoploss
                if (!this.isStopLossTriggered()) {
                    return;
                }
                //change note complete marker color to red to represent stoploss
                this.noteCompleteMarkerColor = "#FE4A4A";
                this.trailer_percent_string = "";
                this.trailer_price_string = "";
            };
            this.checkOrderStateCompletedOrStopped = function() {
                if (
                    this.isStopLossTriggered() ||
                    this.isOrderStateCompleted()
                ) {
                    return;
                }
                this.highest_target_percent_string = "";
                this.lowest_target_percent_string = "";
            };
            this.checkOrderCompleted = function() {
                if (this.isOrderCompleted()) {
                    return;
                }
                //if order is not complete, set long position to be displayed till current time
                this.entry_completed = earliest_entry_filled;
                this.orderCompletedStatus = false;
                this.profit_net_usd = -1;
            };
            this.checkOrderFilledBeforeTimewindow = function(
                current_timewindow: Timewindow
            ) {
                //changes if order was filled before specified time_window
                if (!this.isOrderFilledBeforeTimewindow(current_timewindow)) {
                    return;
                }
                //change starting note object to orange to indicate order was
                //filled at an earlier timestamp
                this.noteEntryMarkerColor = "#FF872E";
                this.errorNote =
                    "Error: Order entry should be at " +
                    "\n" +
                    new Date(this.entry_filled * 1000).toUTCString() +
                    "\n" +
                    "Try extending the timewindow range further back." +
                    "\n \n";
                //change entry filled to fit current time window
                this.entry_filled = current_timewindow.from;
            };
            this.checkOrderCompleteAfterTimewindow = function(
                current_timewindow: Timewindow
            ) {
                if (!this.isOrderCompletedAfterTimewindow(current_timewindow)) {
                    return;
                }
                //change ending note object to orange to indicate order was
                //completed at a later timestamp
                console.log("setting order to current_timewindow.to");
                this.noteCompleteMarkerColor = "#FF872E";
                this.errorNoteExit =
                    "Error: Order exit should be at " +
                    "\n" +
                    new Date(this.entry_filled * 1000).toUTCString() +
                    "\n" +
                    "Try extending the timewindow range to an earlier date." +
                    "\n \n";
                //alter entry_completed to fit timewindow to avoid errors
                let time_resolution: string = TradingViewApi.chart().resolution();
                //nudge new entry_completed one bar to the left so that note object is visible/clickable
                let timeAdjustment: number = parseInt(time_resolution);
                this.entry_completed =
                    current_timewindow.to - timeAdjustment * 60;
            };

            this.noteObject = function(
                entryOrExit: "entry" | "exit"
            ): NoteShape {
                //if entry
                let point_1_note = {
                    time: this.entry_filled,
                    price: this.actual_price
                };
                let text =
                    this.errorNote +
                    "Direction: " +
                    this.direction +
                    "\n" +
                    "Strategy: " +
                    this.strategy +
                    "\n" +
                    "State: " +
                    this.state +
                    "\n" +
                    "Reward Percent: " +
                    this.reward_percent +
                    "\n" +
                    "Risk Percent: " +
                    this.risk_percent +
                    "\n" +
                    "Risk Reward Ratio: " +
                    this.risk_reward_ratio +
                    "\n";
                let markerColor = this.noteEntryMarkerColor;

                //if exit
                if (entryOrExit === "exit") {
                    point_1_note = {
                        time: this.entry_completed,
                        price: this.actual_price_exit
                    };
                    text =
                        this.errorNoteExit +
                        "State: " +
                        this.state +
                        "\n" +
                        this.highest_target_percent_string +
                        this.lowest_target_percent_string +
                        this.highest_market_percent_string +
                        this.lowest_market_percent_string +
                        this.trailer_percent_string +
                        this.trailer_price_string +
                        "Estimate Fee Total USD: " +
                        this.estimated_fee_total_in_usd +
                        "\n" +
                        "Fee Total USD: " +
                        this.fee_total_in_usd +
                        "\n" +
                        "Estimated Profit Net: " +
                        this.estimated_profit_net +
                        "\n" +
                        "Profit Net: " +
                        this.profit_net_usd +
                        "\n" +
                        "Exit Price: " +
                        this.actual_price_exit;
                    markerColor = this.noteCompleteMarkerColor;
                }
                let points_note: [ShapePoint] = [point_1_note];
                let options_note: NoteOptions = {
                    shape: "note",
                    text: text,
                    lock: false,
                    zOrder: "",
                    overrides: {
                        backgroundTransparency: 70,
                        fontsize: 10,
                        italic: true,
                        markerColor: markerColor
                    }
                };

                return { points: points_note, options: options_note };
            };
            this.datePriceRangeObject = function(
                targetOrStop: "target" | "stop"
            ): DatePriceRangeShape {
                let point_2_price = this.target_price;
                let backgroundColor: "#00A000" | "#FF0000" = "#00A000";

                if (targetOrStop === "stop") {
                    point_2_price = this.stop_loss;
                    backgroundColor = "#FF0000";
                }
                let point_1 = {
                    time: this.entry_filled,
                    price: this.actual_price
                };
                let point_2 = {
                    time: this.entry_completed,
                    price: point_2_price
                };
                let points: [ShapePoint, ShapePoint] = [point_1, point_2];
                let options: DatePriceRangeOptions = {
                    shape: "date_and_price_range",
                    text: "",
                    lock: false,
                    zOrder: "",
                    overrides: {
                        backgroundColor: backgroundColor,
                        labelBackgroundTransparency: 50
                    }
                };

                return { points: points, options: options };
            };

            //run checks on order and adjust variables accordingly
            this.checkStopLossTriggered();
            this.checkOrderStateCompletedOrStopped();
            this.checkOrderFilledBeforeTimewindow(current_timewindow);
            this.checkOrderCompleted();
            this.checkOrderCompleteAfterTimewindow(current_timewindow);
        }
    }
}
