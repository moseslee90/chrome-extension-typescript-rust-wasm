let toggleChartId = <HTMLInputElement>document.getElementById("toggleChartId");
let setChartIdGroup = <HTMLDivElement>(
    document.getElementById("setChartIdGroup")
);
let chartIdElement = <HTMLInputElement>document.getElementById("chartId");
// Saves options to chrome.storage
let saveButton = <HTMLButtonElement>document.getElementById("save");
function save_options() {
    let chartId: string = chartIdElement.value;
    let toggleState: boolean = toggleChartId.checked;

    chrome.storage.sync.set(
        {
            chartId: chartId,
            chartIdSet: toggleState
        },
        function() {
            // Update status to let user know options were saved.
            var status = <HTMLDivElement>document.getElementById("status");
            status.textContent = "Options saved.";
            setTimeout(function() {
                status.textContent = "";
            }, 750);
        }
    );
}

// stored in chrome.storage.
function restore_options() {
    chrome.storage.sync.get(
        {
            chartId: "",
            chartIdSet: false
        },
        function(items) {
            toggleChartId.checked = items.chartIdSet;
            checkChartIdToggleState();
            chartIdElement.value = items.chartId;
        }
    );
}

function checkChartIdToggleState() {
    let toggleState: boolean = toggleChartId.checked;
    if (toggleState) {
        setChartIdGroup.classList.remove("display-hidden");
    } else {
        setChartIdGroup.classList.add("display-hidden");
    }
}

toggleChartId.onclick = checkChartIdToggleState;
saveButton.onclick = save_options;

document.addEventListener("DOMContentLoaded", restore_options);
