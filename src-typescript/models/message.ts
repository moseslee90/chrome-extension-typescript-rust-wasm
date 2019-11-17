interface MessageTimewindow {
    type: "timewindow";
    timewindow: number;
}

interface MessageUpdateFromPopup {
    type: "update_from_popup";
    timewindow: number;
    _index: string;
}

interface MessageTradeData {
    type: "trade_data";
    trade_data: [OrderInterface];
}

interface MessageError {
    type: "error";
    error: string;
}

interface MessageTradePair {
    type: "trade_pair";
    _index: string;
    timewindow: Timewindow;
    trade_pair: string;
    original_timewindow: Timewindow;
}
