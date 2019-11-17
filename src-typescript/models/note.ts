interface NoteOptions {
    shape: "note";
    text: string;
    lock: boolean;
    zOrder: string;
    overrides: {
        backgroundTransparency: 70;
        fontsize: 10;
        italic: true;
        markerColor: string;
    };
}

interface NoteCompletedShapeData {
    status: boolean;
    points: [ShapePoint];
    options: NoteOptions;
}

interface NoteShape {
    points: [ShapePoint];
    options: NoteOptions;
}
