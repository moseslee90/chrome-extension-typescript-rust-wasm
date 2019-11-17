let toggleManualTimewindowCheckbox = <HTMLInputElement>(
    document.getElementById("toggleManual")
);
let daySelect = <HTMLSelectElement>document.getElementById("daySelect");
let hourSelect = <HTMLSelectElement>document.getElementById("hourSelect");
let minuteSelect = <HTMLSelectElement>document.getElementById("minuteSelect");
let confirmButton = <HTMLButtonElement>document.getElementById("confirmButton");
let optionsButton = <HTMLButtonElement>document.getElementById("go-to-options");
let _indexInput = <HTMLInputElement>document.getElementById("_indexInput");
let default_index: string = "gammat_prod_01d";

function generateOptions(
    selectElement: HTMLSelectElement,
    startValue: number,
    endValue: number
) {
    for (let index = startValue; index <= endValue; index++) {
        let optionElement: HTMLOptionElement = document.createElement("option");
        let stringValue = index.toString();
        optionElement.setAttribute("value", stringValue);
        optionElement.text = stringValue;
        selectElement.appendChild(optionElement);
    }
}

function sendPopupSettingsToWindow(timewindowSeconds: number, _index: string) {
    chrome.runtime.sendMessage({
        type: "update_from_popup",
        timewindow: timewindowSeconds,
        _index: _index
    });
}

function toggleManualTimewindowVisibility(setVisible: boolean) {
    if (setVisible) {
        daySelect.classList.remove("display-hidden");
        hourSelect.classList.remove("display-hidden");
        minuteSelect.classList.remove("display-hidden");
        getAndSetManualTimewindowInputs();
    } else {
        daySelect.classList.add("display-hidden");
        hourSelect.classList.add("display-hidden");
        minuteSelect.classList.add("display-hidden");
    }
}

function storeManualTimewindowVisibility(visible: boolean) {
    chrome.storage.sync.set({ popup_manual_time_window: visible });
}

function getAndSetManualTimewindowVisibility() {
    chrome.storage.sync.get({ popup_manual_time_window: false }, msg => {
        if (msg.popup_manual_time_window !== undefined) {
            let visibility = <boolean>msg.popup_manual_time_window;
            //update toggle state
            toggleManualTimewindowCheckbox.checked = visibility;
            //update dialog state
            toggleManualTimewindowVisibility(visibility);
        }
    });
}

function getAndSetTimeSelectInputs() {
    let days: number = 0;
    let hours: number = 0;
    let minutes: number = 0;
    let totalSeconds: number = -1;
    if (
        !(
            daySelect.classList.contains("display-hidden") ||
            hourSelect.classList.contains("display-hidden") ||
            minuteSelect.classList.contains("display-hidden")
        )
    ) {
        console.log("processing new time window");
        days = parseInt(daySelect.value);
        hours = parseInt(hourSelect.value);
        minutes = parseInt(minuteSelect.value);
        let daysInSeconds = days * 24 * 60 * 60;
        let hoursInSeconds = hours * 60 * 60;
        let minutesInSeconds = minutes * 60;
        totalSeconds = daysInSeconds + hoursInSeconds + minutesInSeconds;
    }
    if (totalSeconds === 0) {
        totalSeconds = -1;
    }
    chrome.storage.sync.set({
        days_select_value: days,
        hours_select_value: hours,
        minutes_select_value: minutes,
        total_seconds: totalSeconds
    });
    return totalSeconds;
}

function get_index() {
    //get _index and display its value in the popup input
    chrome.storage.sync.get({ _index: default_index }, msg => {
        if (msg._index !== undefined) {
            //update _index value displayed
            let indexValue: string = msg._index;
            _indexInput.value = indexValue;
        } else {
            //if a value of _index is not defined, use the default value
            //"gammat_prod_01d"
            chrome.storage.sync.set({ _index: default_index }, () => {
                _indexInput.value = default_index;
            });
        }
    });
}

function set_index(_indexValue: string) {
    chrome.storage.sync.set({ _index: _indexValue });
}

function getAndSetManualTimewindowInputs() {
    chrome.storage.sync.get(
        {
            days_select_value: 0,
            hours_select_value: 0,
            minutes_select_value: 0
        },
        msg => {
            if (msg.days_select_value !== undefined) {
                let daysSelectValue: string = msg.days_select_value.toString();
                daySelect.value = daysSelectValue;
            }
            if (msg.hours_select_value !== undefined) {
                let hoursSelectValue: string = msg.hours_select_value.toString();
                hourSelect.value = hoursSelectValue;
            }
            if (msg.minutes_select_value !== undefined) {
                let minuteSelectValue: string = msg.minutes_select_value.toString();
                minuteSelect.value = minuteSelectValue;
            }
        }
    );
}

function onClickToggleManualCheckbox() {
    let toggleState = toggleManualTimewindowCheckbox.checked;
    toggleManualTimewindowVisibility(toggleState);
}

function onClickConfirm() {
    let _indexValue = _indexInput.value;
    set_index(_indexValue);
    let totalSeconds = getAndSetTimeSelectInputs();
    if (totalSeconds > 0) {
        storeManualTimewindowVisibility(true);
    } else {
        storeManualTimewindowVisibility(false);
    }
    sendPopupSettingsToWindow(totalSeconds, _indexValue);
}

function onClickOptionsButton() {
    if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
    } else {
        window.open(chrome.runtime.getURL("options.html"));
    }
}
get_index();
getAndSetManualTimewindowVisibility();
generateOptions(daySelect, 0, 7);
generateOptions(hourSelect, 0, 23);
generateOptions(minuteSelect, 0, 59);

toggleManualTimewindowCheckbox.onclick = onClickToggleManualCheckbox;
confirmButton.onclick = onClickConfirm;
optionsButton.onclick = onClickOptionsButton;
