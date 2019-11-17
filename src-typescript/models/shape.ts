interface ShapePoint {
    time: number;
    price: number;
}

interface ShapeIdMap {
    shapesToOrdersMap: {
        [shape_id: string]: string;
    };
    ordersToShapesMap: {
        [shape_id: string]: string;
    };
}

interface OrderShapesIds {
    targetId: string;
    stopId: string;
    noteId: string;
    noteCompletedId: string;
}

interface ShapesGroupMap {
    [target_id: string]: {
        orderShapeIds: OrderShapesIds;
        entry: number;
        exit: number;
    };
}
