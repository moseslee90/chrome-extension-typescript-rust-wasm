interface TradeDataMap {
    [trade_pair_for_index: string]: {
        orders: {
            [order_id: string]: OrderInterface;
        };
        timewindow: Timewindow;
    };
}
