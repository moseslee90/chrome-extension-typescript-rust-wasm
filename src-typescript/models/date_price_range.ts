interface DatePriceRangeOptions {
    shape: "date_and_price_range";
    text: string;
    lock: boolean;
    zOrder: string;
    overrides: {
        backgroundColor: "#00A000" | "#FF0000";
        labelBackgroundTransparency: 50;
    };
}

interface DatePriceRangeShape {
    points: [ShapePoint, ShapePoint];
    options: DatePriceRangeOptions;
}
