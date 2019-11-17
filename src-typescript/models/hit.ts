interface Hit {
    _source: {
        "@timestamp": string;
        data: {
            order: {
                direction: string;
                entry: {
                    actual_price: number;
                    quantity_filled: number;
                };
                estimated_fee_total_in_usd: number;
                estimated_loss_gross: number;
                estimated_loss_net: number;
                estimated_profit_gross: number;
                estimated_profit_net: number;
                exit: {
                    actual_price: number;
                    target_price: number;
                };
                fee_total_in_usd: number;
                highest_target_percent: number;
                highest_market_percent: number;
                id: string;
                lowest_target_percent: number;
                lowest_market_percent: number;
                profit_net_usd: number;
                state: string;
                strategy: string;
                stop_loss_limit: number;
                reward_percent: number;
                risk_percent: number;
                risk_reward_ratio: number;
                timeline: {
                    completed: string;
                    entry_filled: string;
                };
                trailer_percent: number;
                trailer_price: number;
            };
        };
    };
}
