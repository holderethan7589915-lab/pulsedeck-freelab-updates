        const state = {
            port: null,
            reader: null,
            keepReading: false,
            isWriting: false,
            packetBuffer: [],
            totalBytes: 0,
            lastFrameHex: "",
            packetHistory: [],
            packetEvents: [],
            packetStats: {
                data: 0,
                heartbeat: 0,
                invalid: 0,
                discarded: 0
            },
            serialLogEntries: [],
            sendHistory: [],
            autoSendTimer: null,
            simulationTimers: [],
            serialLogRenderQueued: false,
            packetRenderQueued: false,
            lastParsedFields: [],
            lastUwbTelemetry: null,
            lastFrameBytes: [],
            lastMk8000Seq: null,
            isSerialSupported: "serial" in navigator
        };

        const runtime = window.desktopShell || {};

        const colorPool = ["#38bdf8", "#22c55e", "#f59e0b", "#fb7185", "#a78bfa", "#2dd4bf", "#f97316"];
        const mk8000UartSpec = {
            frameLength: 48,
            header: [0xA5, 0x66],
            footer: [0xFD],
            cmd: 0x3C,
            len: 0x29,
            flagDistValid: 1 << 0,
            flagAngleValid: 1 << 1,
            flagVoiceValid: 1 << 2,
            flagImuValid: 1 << 3,
            flagPairing: 1 << 4,
            pairStatusUnpaired: 0x00,
            pairStatusPaired: 0x01,
            pairStatusPairing: 0x02,
            linkOk: 0x81,
            linkLost: 0x80
        };
        const legacyMk8000UartSpec = {
            frameLength: 38,
            header: [0xA5, 0x66],
            footer: [0xFD],
            cmd: 0x3C,
            len: 0x1F
        };
        const legacyRemoteTpSpec = {
            frameLength: 37,
            header: [0xA5, 0x66],
            footer: [0xFD],
            cmd: 0x3C,
            len: 0x1E
        };
        const telemetryBindingMeta = [
            { key: "linkState", label: "LINK" },
            { key: "seq", label: "SEQ" },
            { key: "mode", label: "MODE" },
            { key: "distSet", label: "DIST_SET" },
            { key: "fom", label: "AZ_FOM" },
            { key: "elevationFom", label: "ELE_FOM" },
            { key: "voiceCmd", label: "VOICE_CMD" },
            { key: "flags", label: "FLAGS" },
            { key: "pairId", label: "PAIR_ID" },
            { key: "pairStatus", label: "PAIR_STATUS" },
            { key: "finalRxRate", label: "FINAL_RX_RATE" },
            { key: "rangingRate", label: "RANGING_RATE" },
            { key: "linkQuality", label: "LINK_QUALITY" },
            { key: "keyBitmap", label: "KEY_BITMAP" },
            { key: "protoVer", label: "PROTO_VER" },
            { key: "distanceCm", label: "UWB_DIST" },
            { key: "angleDeg", label: "UWB_ANGLE" },
            { key: "elevationDeg", label: "UWB_ELEV" },
            { key: "joyX", label: "JOY_X" },
            { key: "joyY", label: "JOY_Y" },
            { key: "accX", label: "ACC_X" },
            { key: "accY", label: "ACC_Y" },
            { key: "accZ", label: "ACC_Z" },
            { key: "gyroX", label: "GYRO_X" },
            { key: "gyroY", label: "GYRO_Y" },
            { key: "gyroZ", label: "GYRO_Z" }
        ];
        const telemetryBindingDefaults = {
            linkState: "LINK_STATE",
            seq: "SEQ",
            mode: "MODE",
            distSet: "DIST_SET",
            fom: "AZ_FOM",
            elevationFom: "ELE_FOM",
            voiceCmd: "VOICE_CMD",
            flags: "FLAGS",
            pairId: "PAIR_ID",
            pairStatus: "PAIR_STATUS",
            finalRxRate: "FINAL_RX_RATE",
            rangingRate: "RANGING_RATE",
            linkQuality: "LINK_QUALITY",
            keyBitmap: "KEY_BITMAP",
            protoVer: "PROTO_VER",
            distanceCm: "UWB_DIST",
            angleDeg: "UWB_ANGLE",
            elevationDeg: "UWB_ELEV",
            joyX: "JOY_X",
            joyY: "JOY_Y",
            accX: "ACC_X",
            accY: "ACC_Y",
            accZ: "ACC_Z",
            gyroX: "GYRO_X",
            gyroY: "GYRO_Y",
            gyroZ: "GYRO_Z"
        };

        const dom = {
            connectBtn: document.getElementById("connectBtn"),
            disconnectBtn: document.getElementById("disconnectBtn"),
            newWindowBtn: document.getElementById("newWindowBtn"),
            serialSupportChip: document.getElementById("serialSupportChip"),
            runtimeHint: document.getElementById("runtimeHint"),
            connectionLabel: document.getElementById("connectionLabel"),
            totalBytes: document.getElementById("totalBytes"),
            baudRate: document.getElementById("baudRate"),
            dataBits: document.getElementById("dataBits"),
            stopBits: document.getElementById("stopBits"),
            parity: document.getElementById("parity"),
            themeToggleBtn: document.getElementById("themeToggleBtn"),
            modeTabs: document.getElementById("modeTabs"),
            packetMode: document.getElementById("packetMode"),
            serialMode: document.getElementById("serialMode"),
            packetLayerTabs: document.getElementById("packetLayerTabs"),
            packetOverviewView: document.getElementById("packetOverviewView"),
            packetMappingView: document.getElementById("packetMappingView"),
            parseMode: document.getElementById("parseMode"),
            packetLength: document.getElementById("packetLength"),
            packetHeader: document.getElementById("packetHeader"),
            packetFooter: document.getElementById("packetFooter"),
            checksumType: document.getElementById("checksumType"),
            checksumIncludeHeader: document.getElementById("checksumIncludeHeader"),
            heartbeatOffset: document.getElementById("heartbeatOffset"),
            heartbeatValue: document.getElementById("heartbeatValue"),
            liveParseToggle: document.getElementById("liveParseToggle"),
            templateName: document.getElementById("templateName"),
            addFieldBtn: document.getElementById("addFieldBtn"),
            saveTemplateBtn: document.getElementById("saveTemplateBtn"),
            loadTemplateBtn: document.getElementById("loadTemplateBtn"),
            simulateFrameBtn: document.getElementById("simulateFrameBtn"),
            resetPacketStateBtn: document.getElementById("resetPacketStateBtn"),
            telemetryBindingMode: document.getElementById("telemetryBindingMode"),
            telemetryBindingHint: document.getElementById("telemetryBindingHint"),
            telemetryBindingDesc: document.getElementById("telemetryBindingDesc"),
            telemetryBindingList: document.getElementById("telemetryBindingList"),
            fieldTableBody: document.getElementById("fieldTableBody"),
            currentModeText: document.getElementById("currentModeText"),
            packetStatusText: document.getElementById("packetStatusText"),
            syncState: document.getElementById("syncState"),
            bufferBytes: document.getElementById("bufferBytes"),
            validFrames: document.getElementById("validFrames"),
            heartbeatFrames: document.getElementById("heartbeatFrames"),
            invalidFrames: document.getElementById("invalidFrames"),
            discardedBytes: document.getElementById("discardedBytes"),
            packetHexPreview: document.getElementById("packetHexPreview"),
            metricGrid: document.getElementById("metricGrid"),
            packetEventList: document.getElementById("packetEventList"),
            packetHistoryBody: document.getElementById("packetHistoryBody"),
            historyHeadRow: document.getElementById("historyHeadRow"),
            fieldHistoryBody: document.getElementById("fieldHistoryBody"),
            fieldHistoryHeadRow: document.getElementById("fieldHistoryHeadRow"),
            serialLog: document.getElementById("serialLog"),
            receiveViewMode: document.getElementById("receiveViewMode"),
            timestampMode: document.getElementById("timestampMode"),
            clearLogBtn: document.getElementById("clearLogBtn"),
            exportLogBtn: document.getElementById("exportLogBtn"),
            autoScrollToggle: document.getElementById("autoScrollToggle"),
            showTxToggle: document.getElementById("showTxToggle"),
            showRxToggle: document.getElementById("showRxToggle"),
            sendFormat: document.getElementById("sendFormat"),
            lineEnding: document.getElementById("lineEnding"),
            sendInput: document.getElementById("sendInput"),
            sendBtn: document.getElementById("sendBtn"),
            autoSendInterval: document.getElementById("autoSendInterval"),
            autoSendToggle: document.getElementById("autoSendToggle"),
            stopAutoSendBtn: document.getElementById("stopAutoSendBtn"),
            sendHistory: document.getElementById("sendHistory"),
            sendNote: document.getElementById("sendNote"),
            telemetryLinkBadge: document.getElementById("telemetryLinkBadge"),
            telemetryFlagChips: document.getElementById("telemetryFlagChips"),
            telemetrySeq: document.getElementById("telemetrySeq"),
            telemetryMode: document.getElementById("telemetryMode"),
            telemetryDistSet: document.getElementById("telemetryDistSet"),
            telemetryFom: document.getElementById("telemetryFom"),
            telemetryElevationFom: document.getElementById("telemetryElevationFom"),
            telemetryFinalRxRate: document.getElementById("telemetryFinalRxRate"),
            telemetryRangingRate: document.getElementById("telemetryRangingRate"),
            telemetryLinkQuality: document.getElementById("telemetryLinkQuality"),
            telemetryVoiceB0: document.getElementById("telemetryVoiceB0"),
            telemetryVoiceB1: document.getElementById("telemetryVoiceB1"),
            telemetryFlagsText: document.getElementById("telemetryFlagsText"),
            telemetryPairId: document.getElementById("telemetryPairId"),
            telemetryPairStatus: document.getElementById("telemetryPairStatus"),
            telemetryKeyBitmap: document.getElementById("telemetryKeyBitmap"),
            telemetryProtoVer: document.getElementById("telemetryProtoVer"),
            telemetryDistanceRing: document.getElementById("telemetryDistanceRing"),
            telemetryDistance: document.getElementById("telemetryDistance"),
            telemetryDistanceMeta: document.getElementById("telemetryDistanceMeta"),
            telemetryAngle: document.getElementById("telemetryAngle"),
            telemetryElevation: document.getElementById("telemetryElevation"),
            telemetryJoyDot: document.getElementById("telemetryJoyDot"),
            telemetryJoyX: document.getElementById("telemetryJoyX"),
            telemetryJoyY: document.getElementById("telemetryJoyY"),
            telemetryKeyChips: document.getElementById("telemetryKeyChips"),
            telemetryAccXFill: document.getElementById("telemetryAccXFill"),
            telemetryAccYFill: document.getElementById("telemetryAccYFill"),
            telemetryAccZFill: document.getElementById("telemetryAccZFill"),
            telemetryGyroXFill: document.getElementById("telemetryGyroXFill"),
            telemetryGyroYFill: document.getElementById("telemetryGyroYFill"),
            telemetryGyroZFill: document.getElementById("telemetryGyroZFill"),
            telemetryAccXValue: document.getElementById("telemetryAccXValue"),
            telemetryAccYValue: document.getElementById("telemetryAccYValue"),
            telemetryAccZValue: document.getElementById("telemetryAccZValue"),
            telemetryGyroXValue: document.getElementById("telemetryGyroXValue"),
            telemetryGyroYValue: document.getElementById("telemetryGyroYValue"),
            telemetryGyroZValue: document.getElementById("telemetryGyroZValue"),
            telemetryImuStatus: document.getElementById("telemetryImuStatus")
        };

        function initialize() {
            applySavedTheme();

            if (!state.isSerialSupported) {
                dom.serialSupportChip.textContent = runtime.isElectron
                    ? "当前桌面环境未启用 Web Serial"
                    : "当前浏览器不支持 Web Serial";
                dom.connectBtn.disabled = true;
            } else {
                dom.serialSupportChip.textContent = runtime.isElectron ? "桌面版 Web Serial 可用" : "Web Serial 可用";
                dom.serialSupportChip.classList.add("online");
            }

            if (dom.runtimeHint) {
                dom.runtimeHint.textContent = runtime.isElectron
                    ? "当前为桌面版；需要同时看两路数据时，新开一个窗口分别连接不同串口。"
                    : "建议使用支持 Web Serial 的 Chromium 内核浏览器打开，例如 Edge 或 Chrome。";
            }

            if (runtime.isElectron && dom.newWindowBtn && typeof runtime.openNewWindow === "function") {
                dom.newWindowBtn.hidden = false;
            }

            bindEvents();
            seedDefaultFields();
            renderFieldTable();
            renderTelemetryBindingControls();
            renderMetricCards();
            renderPacketEvents();
            renderPacketHistory();
            renderFieldHistory();
            renderProtocolSummary();
            renderTelemetryDashboard();
            renderSerialLog();
            renderSendHistory();
        }

        function bindEvents() {
            dom.connectBtn.addEventListener("click", connectSerial);
            dom.disconnectBtn.addEventListener("click", disconnectSerial);
            if (dom.newWindowBtn && typeof runtime.openNewWindow === "function") {
                dom.newWindowBtn.addEventListener("click", () => runtime.openNewWindow());
            }
            if (dom.themeToggleBtn) {
                dom.themeToggleBtn.addEventListener("click", toggleTheme);
            }
            dom.modeTabs.addEventListener("click", handleTabSwitch);
            if (dom.packetLayerTabs) {
                dom.packetLayerTabs.addEventListener("click", handlePacketLayerSwitch);
            }
            dom.addFieldBtn.addEventListener("click", addFieldRow);
            dom.saveTemplateBtn.addEventListener("click", saveTemplate);
            dom.loadTemplateBtn.addEventListener("click", loadTemplate);
            dom.simulateFrameBtn.addEventListener("click", simulateFrame);
            dom.resetPacketStateBtn.addEventListener("click", resetPacketWorkspace);
            if (dom.telemetryBindingMode) {
                dom.telemetryBindingMode.addEventListener("change", handleTelemetryBindingModeChange);
            }
            if (dom.telemetryBindingList) {
                dom.telemetryBindingList.addEventListener("change", handleTelemetryBindingChange);
            }
            dom.clearLogBtn.addEventListener("click", () => {
                state.serialLogEntries = [];
                renderSerialLog();
            });
            dom.exportLogBtn.addEventListener("click", exportSerialLog);
            dom.receiveViewMode.addEventListener("change", renderSerialLog);
            dom.timestampMode.addEventListener("change", renderSerialLog);
            dom.showTxToggle.addEventListener("change", renderSerialLog);
            dom.showRxToggle.addEventListener("change", renderSerialLog);
            dom.sendBtn.addEventListener("click", () => sendMessage(false));
            dom.autoSendToggle.addEventListener("change", handleAutoSendToggle);
            dom.stopAutoSendBtn.addEventListener("click", stopAutoSend);
            dom.fieldTableBody.addEventListener("click", handleFieldTableClick);
            dom.fieldTableBody.addEventListener("input", handleFieldInputChange);
            dom.fieldTableBody.addEventListener("change", handleFieldInputChange);

            [
                dom.parseMode,
                dom.packetLength,
                dom.packetHeader,
                dom.packetFooter,
                dom.checksumType,
                dom.checksumIncludeHeader,
                dom.heartbeatOffset,
                dom.heartbeatValue,
                dom.liveParseToggle
            ].forEach((node) => {
                node.addEventListener("input", handleProtocolConfigChange);
                node.addEventListener("change", handleProtocolConfigChange);
            });

            document.querySelectorAll(".preset-btn").forEach((button) => {
                button.addEventListener("click", () => {
                    dom.sendFormat.value = button.dataset.format;
                    dom.sendInput.value = button.dataset.payload;
                });
            });
        }

        function applySavedTheme() {
            const savedTheme = localStorage.getItem("pulse-ui-theme");
            setTheme(savedTheme === "pink" ? "pink" : "dark");
        }

        function toggleTheme() {
            const nextTheme = document.body.dataset.theme === "pink" ? "dark" : "pink";
            setTheme(nextTheme);
            localStorage.setItem("pulse-ui-theme", nextTheme);
        }

        function setTheme(theme) {
            document.body.dataset.theme = theme;
            if (dom.themeToggleBtn) {
                dom.themeToggleBtn.setAttribute("aria-pressed", theme === "pink" ? "true" : "false");
            }
        }

        function handleTabSwitch(event) {
            const tab = event.target.closest(".mode-tab");
            if (!tab) return;

            document.querySelectorAll(".mode-tab").forEach((node) => node.classList.remove("active"));
            tab.classList.add("active");

            const isPacket = tab.dataset.mode === "packet";
            dom.packetMode.classList.toggle("active", isPacket);
            dom.serialMode.classList.toggle("active", !isPacket);

            if (isPacket && tab.dataset.layer) {
                setPacketLayer(tab.dataset.layer);
            }
        }

        function handlePacketLayerSwitch(event) {
            const tab = event.target.closest(".packet-layer-tab");
            if (!tab || !dom.packetLayerTabs) return;

            setPacketLayer(tab.dataset.layer);
        }

        function setPacketLayer(layer) {
            const normalizedLayer = layer === "mapping" ? "mapping" : layer === "visual" ? "visual" : "frame";
            const showOverview = normalizedLayer !== "mapping";
            if (dom.packetMode) {
                dom.packetMode.dataset.layer = normalizedLayer;
            }
            if (dom.packetLayerTabs) {
                dom.packetLayerTabs.querySelectorAll(".packet-layer-tab").forEach((node) => {
                    const nodeLayer = node.dataset.layer === "overview" ? "frame" : node.dataset.layer;
                    node.classList.toggle("active", nodeLayer === normalizedLayer);
                });
            }
            if (dom.packetOverviewView) {
                dom.packetOverviewView.classList.toggle("active", showOverview);
            }
            if (dom.packetMappingView) {
                dom.packetMappingView.classList.toggle("active", !showOverview);
            }
        }

        async function connectSerial() {
            if (!state.isSerialSupported) {
                alert(
                    runtime.isElectron
                        ? "当前桌面环境未启用 Web Serial，请检查 Electron 版本或系统权限。"
                        : "当前浏览器不支持 Web Serial，请使用最新版 Edge 或 Chrome。"
                );
                return;
            }

            try {
                state.port = await navigator.serial.requestPort();
                await state.port.open({
                    baudRate: Number(dom.baudRate.value),
                    dataBits: Number(dom.dataBits.value),
                    stopBits: Number(dom.stopBits.value),
                    parity: dom.parity.value
                });

                state.keepReading = true;
                dom.connectBtn.disabled = true;
                dom.disconnectBtn.disabled = false;
                dom.connectionLabel.textContent = `已连接 @ ${dom.baudRate.value}`;
                appendSerialLog("system", "串口已连接");
                readLoop();
            } catch (error) {
                console.error(error);
                alert(`连接失败: ${error.message}`);
            }
        }

        async function disconnectSerial() {
            stopAutoSend();
            clearSimulationTimers();
            state.keepReading = false;

            try {
                if (state.reader) {
                    await state.reader.cancel();
                    state.reader.releaseLock();
                    state.reader = null;
                }
            } catch (error) {
                console.warn("reader cancel error", error);
            }

            try {
                if (state.port) {
                    await state.port.close();
                }
            } catch (error) {
                console.warn("port close error", error);
            } finally {
                state.port = null;
                dom.connectBtn.disabled = false;
                dom.disconnectBtn.disabled = true;
                dom.connectionLabel.textContent = "未连接";
                appendSerialLog("system", "串口已断开");
            }
        }

        async function readLoop() {
            while (state.port && state.port.readable && state.keepReading) {
                state.reader = state.port.readable.getReader();
                try {
                    while (state.keepReading) {
                        const { value, done } = await state.reader.read();
                        if (done) break;
                        if (value && value.length) handleIncomingBytes(value);
                    }
                } catch (error) {
                    console.error("readLoop error", error);
                    appendSerialLog("system", `读取异常: ${error.message}`);
                } finally {
                    if (state.reader) {
                        state.reader.releaseLock();
                        state.reader = null;
                    }
                }
            }
        }

        function handleIncomingBytes(value, source = "serial") {
            const bytes = Array.from(value);
            if (!bytes.length) return;

            state.totalBytes += bytes.length;
            dom.totalBytes.textContent = String(state.totalBytes);
            appendSerialLog("rx", Uint8Array.from(bytes));
            state.packetBuffer.push(...bytes);
            dom.bufferBytes.textContent = String(state.packetBuffer.length);
            dom.packetStatusText.textContent = `raw-rx ${bytes.length} bytes, buffered ${state.packetBuffer.length}`;

            if (dom.liveParseToggle.checked) {
                tryParsePackets(source);
            } else {
                dom.packetStatusText.textContent = `实时流解析已暂停，缓冲区累计 ${state.packetBuffer.length} 字节`;
                dom.syncState.textContent = state.packetBuffer.length ? "已暂停" : "暂停";
                renderProtocolSummary();
            }
        }

        function tryParsePackets(source = "serial") {
            const config = getProtocolConfig();
            const configError = validateProtocolConfig(config);

            if (configError) {
                dom.packetStatusText.textContent = configError;
                dom.syncState.textContent = "配置待修正";
                renderProtocolSummary();
                return;
            }

            if (isMk8000ProtocolConfig(config)) {
                tryParseMk8000Packets(source, config);
                return;
            }

            let parsedAny = false;
            let safety = 0;

            while (state.packetBuffer.length && safety < 2000) {
                safety += 1;

                if (config.header.bytes.length) {
                    const startIndex = findSequenceIndex(state.packetBuffer, config.header.bytes);
                    if (startIndex === -1) {
                        const preserve = Math.max(0, config.header.bytes.length - 1);
                        const discardCount = Math.max(0, state.packetBuffer.length - preserve);
                        if (discardCount > 0) {
                            state.packetBuffer.splice(0, discardCount);
                            state.packetStats.discarded += discardCount;
                            pushPacketEvent("warn", "未匹配到帧头", `已丢弃 ${discardCount} 字节噪声，继续等待帧头`);
                        }
                        dom.syncState.textContent = "等待帧头";
                        break;
                    }

                    if (startIndex > 0) {
                        state.packetBuffer.splice(0, startIndex);
                        state.packetStats.discarded += startIndex;
                        pushPacketEvent("warn", "帧头重对齐", `丢弃前导字节 ${startIndex} 个，重新进入同步状态`);
                    }
                }

                const step = nextFrameStep(config);
                if (step.type === "wait") {
                    dom.syncState.textContent = step.syncText;
                    break;
                }
                if (step.type === "continue") {
                    dom.bufferBytes.textContent = String(state.packetBuffer.length);
                    continue;
                }

                const validation = validateFrame(step.frame, config);
                if (!validation.valid) {
                    state.packetStats.invalid += 1;
                    const dropped = dropInvalidBytes(config);
                    state.packetStats.discarded += dropped;
                    dom.packetStatusText.textContent = validation.summary;
                    dom.syncState.textContent = "重新同步中";
                    pushPacketEvent("error", validation.summary, `${validation.detail}，已丢弃 ${dropped} 字节后重试`);
                    dom.bufferBytes.textContent = String(state.packetBuffer.length);
                    continue;
                }

                state.packetBuffer.splice(0, step.frame.length);
                const packetKind = classifyFrame(step.frame, config);
                processPacket(step.frame, {
                    isSimulated: source !== "serial",
                    packetKind,
                    validation
                });
                parsedAny = true;
                dom.syncState.textContent = "已同步";
                dom.bufferBytes.textContent = String(state.packetBuffer.length);
            }

            if (safety >= 2000) {
                console.warn("packet parser safety break");
            }

            if (!parsedAny && state.packetBuffer.length === 0) {
                dom.syncState.textContent = "等待数据";
            }

            renderProtocolSummary();
        }

        function tryParseMk8000Packets(source, config) {
            let parsedAny = false;
            let safety = 0;

            while (state.packetBuffer.length && safety < 2000) {
                safety += 1;

                const startIndex = findSequenceIndex(state.packetBuffer, mk8000UartSpec.header);
                if (startIndex === -1) {
                    const preserve = mk8000UartSpec.header.length - 1;
                    const discardCount = Math.max(0, state.packetBuffer.length - preserve);
                    if (discardCount > 0) {
                        state.packetBuffer.splice(0, discardCount);
                        state.packetStats.discarded += discardCount;
                    }
                    dom.syncState.textContent = "等待帧头";
                    break;
                }

                if (startIndex > 0) {
                    state.packetBuffer.splice(0, startIndex);
                    state.packetStats.discarded += startIndex;
                    pushPacketEvent("warn", "帧头重同步", `帧头前丢弃 ${startIndex} 字节噪声`);
                }

                if (state.packetBuffer.length < 4) {
                    dom.syncState.textContent = "等待完整帧";
                    break;
                }

                const lenByte = state.packetBuffer[3];
                let candidateLength = 0;
                let legacyKind = "";

                if (lenByte === mk8000UartSpec.len) {
                    candidateLength = mk8000UartSpec.frameLength;
                } else if (lenByte === legacyMk8000UartSpec.len) {
                    candidateLength = legacyMk8000UartSpec.frameLength;
                    legacyKind = "mk8000";
                } else if (lenByte === legacyRemoteTpSpec.len) {
                    candidateLength = legacyRemoteTpSpec.frameLength;
                    legacyKind = "remoteTp";
                } else {
                    state.packetStats.invalid += 1;
                    state.packetBuffer.splice(0, 1);
                    state.packetStats.discarded += 1;
                    dom.packetStatusText.textContent = "长度字节不匹配";
                    dom.syncState.textContent = "重新同步中";
                    pushPacketEvent("error", "长度字节不匹配", `收到未知 len 字节 0x${lenByte.toString(16).toUpperCase().padStart(2, "0")}`);
                    dom.bufferBytes.textContent = String(state.packetBuffer.length);
                    continue;
                }

                if (state.packetBuffer.length < candidateLength) {
                    dom.syncState.textContent = "等待完整帧";
                    break;
                }

                const rawFrame = state.packetBuffer.slice(0, candidateLength);
                const validation = legacyKind === "remoteTp"
                    ? validateLegacyRemoteTpFrame(rawFrame)
                    : legacyKind === "mk8000"
                        ? validateLegacyMk8000UartFrame(rawFrame)
                        : validateMk8000Frame(rawFrame, config);

                if (!validation.valid) {
                    state.packetStats.invalid += 1;
                    state.packetBuffer.splice(0, 1);
                    state.packetStats.discarded += 1;
                    dom.packetStatusText.textContent = validation.summary;
                    dom.syncState.textContent = "重新同步中";
                    pushPacketEvent("error", validation.summary, `${validation.detail}，丢弃 1 字节后重试`);
                    dom.bufferBytes.textContent = String(state.packetBuffer.length);
                    continue;
                }

                state.packetBuffer.splice(0, candidateLength);

                const frame = legacyKind === "remoteTp"
                    ? normalizeLegacyRemoteTpFrame(rawFrame)
                    : legacyKind === "mk8000"
                        ? normalizeLegacyMk8000UartFrame(rawFrame)
                        : rawFrame;
                if (legacyKind === "remoteTp") {
                    pushPacketEvent("info", "兼容旧版帧", "收到 legacy 37-byte remote_tp 帧，已归一化为 48-byte 视图");
                } else if (legacyKind === "mk8000") {
                    pushPacketEvent("info", "兼容旧版帧", "收到 legacy 38-byte MK8000 帧，已归一化为 48-byte 视图");
                }

                const seq = frame[4];
                if (typeof state.lastMk8000Seq === "number") {
                    const expectedSeq = (state.lastMk8000Seq + 1) & 0xFF;
                    if (seq !== expectedSeq) {
                        pushPacketEvent("warn", "序号跳变", `上一帧 ${state.lastMk8000Seq}，当前 ${seq}，期望 ${expectedSeq}`);
                    }
                }
                state.lastMk8000Seq = seq;

                processPacket(frame, {
                    isSimulated: source !== "serial",
                    packetKind: "data",
                    validation
                });
                parsedAny = true;
                dom.syncState.textContent = "已同步";
                dom.bufferBytes.textContent = String(state.packetBuffer.length);
            }

            if (safety >= 2000) {
                console.warn("mk8000 parser safety break");
            }

            if (!parsedAny && state.packetBuffer.length === 0) {
                dom.syncState.textContent = "等待数据";
            }

            renderProtocolSummary();
        }

        function nextFrameStep(config) {
            const minLength = minimalFrameLength(config);

            if (config.mode === "tail") {
                if (state.packetBuffer.length < minLength) {
                    return { type: "wait", syncText: "等待帧尾" };
                }

                const footerIndex = findSequenceIndex(
                    state.packetBuffer,
                    config.footer.bytes,
                    Math.max(config.header.bytes.length, 0)
                );

                if (footerIndex === -1) {
                    if (config.frameLength && state.packetBuffer.length > config.frameLength) {
                        state.packetStats.invalid += 1;
                        state.packetBuffer.splice(0, 1);
                        state.packetStats.discarded += 1;
                        dom.packetStatusText.textContent = "超过最大帧长仍未找到帧尾";
                        pushPacketEvent("error", "等待帧尾超时", `已经超过配置上限 ${config.frameLength} 字节，丢弃 1 字节继续同步`);
                        return { type: "continue" };
                    }

                    return { type: "wait", syncText: "等待帧尾" };
                }

                const candidateLength = footerIndex + config.footer.bytes.length;
                if (candidateLength < minLength) {
                    state.packetStats.invalid += 1;
                    state.packetBuffer.splice(0, 1);
                    state.packetStats.discarded += 1;
                    dom.packetStatusText.textContent = "候选帧长度不足";
                    pushPacketEvent("error", "候选帧过短", `当前找到的帧尾过早，候选长度 ${candidateLength} 小于最小帧长 ${minLength}`);
                    return { type: "continue" };
                }

                if (config.frameLength && candidateLength > config.frameLength) {
                    state.packetStats.invalid += 1;
                    state.packetBuffer.splice(0, 1);
                    state.packetStats.discarded += 1;
                    dom.packetStatusText.textContent = "候选帧长度越界";
                    pushPacketEvent("error", "候选帧越界", `当前长度 ${candidateLength} 超过配置上限 ${config.frameLength}`);
                    return { type: "continue" };
                }

                return { type: "candidate", frame: state.packetBuffer.slice(0, candidateLength) };
            }

            if (state.packetBuffer.length < config.frameLength) {
                return { type: "wait", syncText: "等待完整帧" };
            }

            return { type: "candidate", frame: state.packetBuffer.slice(0, config.frameLength) };
        }

        function processPacket(frame, options) {
            const fields = getFieldConfigs();
            const parsed = parseFrame(frame, fields);
            const kindLabel = options.packetKind === "heartbeat" ? "心跳包" : "数据包";
            const sourceLabel = options.isSimulated ? "模拟" : "实时";

            if (options.packetKind === "heartbeat") {
                state.packetStats.heartbeat += 1;
                pushPacketEvent("info", "收到心跳包", options.validation.detail);
            } else {
                state.packetStats.data += 1;
                pushPacketEvent("success", "收到有效数据包", options.validation.detail);
            }

            state.lastFrameHex = bytesToHex(frame);
            state.lastFrameBytes = Array.from(frame);
            state.lastParsedFields = parsed;
            state.lastUwbTelemetry = extractMk8000Telemetry(frame);
            dom.packetHexPreview.value = formatHexBlock(frame);
            dom.packetStatusText.textContent = `${sourceLabel}${kindLabel}已解析，${options.validation.verdict}`;

            state.packetHistory.unshift({
                time: formatDisplayTime(new Date(), true),
                kind: kindLabel,
                verdict: options.validation.verdict,
                rawHex: state.lastFrameHex,
                fields: parsed
            });
            state.packetHistory = state.packetHistory.slice(0, 12);

            schedulePacketRender();
        }

        function parseFrame(frame, fields) {
            return fields.map((field, index) => {
                const slice = frame.slice(field.offset, field.offset + field.length);
                let displayValue = "--";
                let numericValue = null;

                try {
                    if (slice.length < field.length) {
                        displayValue = "越界";
                    } else {
                        const parsed = parseByType(slice, field.type);
                        if (typeof parsed === "number") {
                            numericValue = parsed * field.scale + field.bias;
                            displayValue = formatNumber(numericValue);
                            if (displayValue === "--") {
                                numericValue = null;
                            }
                        } else {
                            displayValue = parsed;
                        }
                    }
                } catch (error) {
                    displayValue = "解析失败";
                }

                if (field.unit && !["--", "越界", "解析失败"].includes(displayValue)) {
                    displayValue = `${displayValue} ${field.unit}`;
                }

                return {
                    ...field,
                    color: colorPool[index % colorPool.length],
                    rawHex: bytesToHex(slice),
                    displayValue,
                    numericValue
                };
            });
        }

        function parseByType(bytes, type) {
            const array = Uint8Array.from(bytes);
            const view = new DataView(array.buffer);

            switch (type) {
                case "u8": return view.getUint8(0);
                case "s8": return view.getInt8(0);
                case "u16le": return view.getUint16(0, true);
                case "u16be": return view.getUint16(0, false);
                case "s16le": return view.getInt16(0, true);
                case "s16be": return view.getInt16(0, false);
                case "u32le": return view.getUint32(0, true);
                case "u32be": return view.getUint32(0, false);
                case "floatle": return view.getFloat32(0, true);
                case "floatbe": return view.getFloat32(0, false);
                case "hex": return bytesToHex(bytes);
                case "ascii": return new TextDecoder().decode(array).replace(/[^\x20-\x7E]/g, ".");
                default: return bytesToHex(bytes);
            }
        }

        function formatNumber(value) {
            if (!Number.isFinite(value)) return "--";
            return Math.abs(value) >= 1000 ? value.toFixed(1) : value.toFixed(2).replace(/\.00$/, "");
        }

        function handleFieldTableClick(event) {
            const removeButton = event.target.closest("[data-remove-index]");
            if (!removeButton) return;

            const index = Number(removeButton.dataset.removeIndex);
            const rows = getFieldConfigs();
            rows.splice(index, 1);
            renderFieldTable(rows);
            handleProtocolConfigChange();
        }

        function handleFieldInputChange(event) {
            const row = event.target.closest("tr");
            if (!row) return;

            if (event.target.dataset.key === "type") {
                const recommended = recommendedLength(event.target.value);
                const lengthInput = row.querySelector('[data-key="length"]');
                if (recommended) lengthInput.value = recommended;
            }

            renderMetricCards();
            renderPacketHistory();
            renderFieldHistory();
            renderProtocolSummary();
            renderTelemetryBindingControls();
            renderTelemetryDashboard();
        }

        function handleTelemetryBindingModeChange() {
            renderTelemetryBindingControls();
            renderTelemetryDashboard();
        }

        function handleTelemetryBindingChange(event) {
            if (!event.target.matches("[data-telemetry-slot]")) return;
            renderTelemetryDashboard();
        }

        function recommendedLength(type) {
            const map = {
                u8: 1, s8: 1, u16le: 2, u16be: 2, s16le: 2, s16be: 2,
                u32le: 4, u32be: 4, floatle: 4, floatbe: 4
            };
            return map[type] || "";
        }

        function addFieldRow() {
            const rows = getFieldConfigs();
            rows.push({
                name: `瀛楁${rows.length + 1}`,
                offset: 0,
                length: 1,
                type: "u8",
                scale: 1,
                bias: 0,
                unit: "",
                enabled: true
            });
            renderFieldTable(rows);
            renderTelemetryBindingControls();
            renderProtocolSummary();
        }

        function seedDefaultFields() {
            applyMk8000Template();
            return;
            renderFieldTable([
                { name: "帧头", offset: 0, length: 2, type: "hex", scale: 1, bias: 0, unit: "", enabled: true },
                { name: "命令字", offset: 2, length: 1, type: "u8", scale: 1, bias: 0, unit: "", enabled: true },
                { name: "娓╁害", offset: 3, length: 2, type: "u16le", scale: 0.1, bias: 0, unit: "掳C", enabled: true },
                { name: "婀垮害", offset: 5, length: 2, type: "u16le", scale: 0.1, bias: 0, unit: "%RH", enabled: true },
                { name: "鐢靛帇", offset: 7, length: 2, type: "u16le", scale: 0.01, bias: 0, unit: "V", enabled: true },
                { name: "状态", offset: 9, length: 1, type: "u8", scale: 1, bias: 0, unit: "", enabled: true },
                { name: "校验", offset: 10, length: 1, type: "hex", scale: 1, bias: 0, unit: "", enabled: false },
                { name: "帧尾", offset: 11, length: 1, type: "hex", scale: 1, bias: 0, unit: "", enabled: false }
            ]);
            dom.packetHeader.value = "AA55";
            dom.packetFooter.value = "0D";
            dom.checksumType.value = "xor8";
            dom.heartbeatValue.value = "01";
            dom.heartbeatOffset.value = "2";
        }

        function renderFieldTable(rows = getFieldConfigs()) {
            dom.fieldTableBody.innerHTML = "";
            rows.forEach((field, index) => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><input data-key="name" value="${escapeHtml(field.name)}"></td>
                    <td><input data-key="offset" type="number" min="0" value="${field.offset}"></td>
                    <td><input data-key="length" type="number" min="1" value="${field.length}"></td>
                    <td><select data-key="type">${renderTypeOptions(field.type)}</select></td>
                    <td><input data-key="scale" type="number" step="0.01" value="${field.scale}"></td>
                    <td><input data-key="bias" type="number" step="0.01" value="${field.bias}"></td>
                    <td><input data-key="unit" value="${escapeHtml(field.unit)}"></td>
                    <td style="text-align:center;"><input data-key="enabled" type="checkbox" ${(field.enabled ?? field.chart ?? true) ? "checked" : ""}></td>
                    <td><button class="btn-secondary" data-remove-index="${index}">删除</button></td>
                `;
                dom.fieldTableBody.appendChild(tr);
            });
            renderTelemetryBindingControls();
        }

        function renderTypeOptions(selectedType) {
            const options = [
                ["u8", "U8"], ["s8", "S8"], ["u16le", "U16 LE"], ["u16be", "U16 BE"],
                ["s16le", "S16 LE"], ["s16be", "S16 BE"], ["u32le", "U32 LE"], ["u32be", "U32 BE"],
                ["floatle", "Float LE"], ["floatbe", "Float BE"], ["hex", "Hex"], ["ascii", "ASCII"]
            ];

            return options.map(([value, label]) =>
                `<option value="${value}" ${value === selectedType ? "selected" : ""}>${label}</option>`
            ).join("");
        }

        function getFieldConfigs() {
            return Array.from(dom.fieldTableBody.querySelectorAll("tr")).map((row) => ({
                name: row.querySelector('[data-key="name"]').value.trim() || "未命名字段",
                offset: Number(row.querySelector('[data-key="offset"]').value || 0),
                length: Number(row.querySelector('[data-key="length"]').value || 1),
                type: row.querySelector('[data-key="type"]').value,
                scale: Number(row.querySelector('[data-key="scale"]').value || 1),
                bias: Number(row.querySelector('[data-key="bias"]').value || 0),
                unit: row.querySelector('[data-key="unit"]').value.trim(),
                enabled: row.querySelector('[data-key="enabled"]').checked
            }));
        }

        function renderTelemetryBindingControls(preferredBindings = null) {
            if (!dom.telemetryBindingList || !dom.telemetryBindingMode) return;

            const mode = dom.telemetryBindingMode.value;
            const bindings = preferredBindings || getTelemetryFieldBindings();
            const fieldNames = getFieldConfigs()
                .map((field) => field.name.trim())
                .filter(Boolean);

            if (dom.telemetryBindingHint) {
                dom.telemetryBindingHint.textContent = mode === "fixed" ? "固定协议映射" : "字段表绑定";
            }

            if (dom.telemetryBindingDesc) {
                dom.telemetryBindingDesc.textContent = mode === "fixed"
                    ? "固定协议映射会继续按 MK8000 48-byte 视图解析；legacy 37-byte 帧也会先归一化后再展示。"
                    : "字段表绑定只影响左侧重要参数面板；右侧启用字段结果、历史记录和协议解析仍然按当前字段表运行。";
            }

            dom.telemetryBindingList.hidden = mode !== "field";
            if (mode !== "field") {
                dom.telemetryBindingList.innerHTML = "";
                return;
            }

            dom.telemetryBindingList.innerHTML = telemetryBindingMeta.map((item) => {
                const selected = bindings[item.key] || telemetryBindingDefaults[item.key] || "";
                return `
                    <label class="mapping-row">
                        <span>${escapeHtml(item.label)}</span>
                        <select data-telemetry-slot="${item.key}">
                            ${renderTelemetryBindingOptions(fieldNames, selected)}
                        </select>
                    </label>
                `;
            }).join("");
        }

        function renderTelemetryBindingOptions(fieldNames, selected) {
            const options = ['<option value="">-- 未绑定 --</option>'];
            const names = Array.from(new Set(fieldNames));
            names.forEach((name) => {
                options.push(`<option value="${escapeHtml(name)}" ${name === selected ? "selected" : ""}>${escapeHtml(name)}</option>`);
            });
            return options.join("");
        }

        function getTelemetryFieldBindings() {
            const bindings = {};
            telemetryBindingMeta.forEach((item) => {
                const select = dom.telemetryBindingList
                    ? dom.telemetryBindingList.querySelector(`[data-telemetry-slot="${item.key}"]`)
                    : null;
                bindings[item.key] = select ? select.value : (telemetryBindingDefaults[item.key] || "");
            });
            return bindings;
        }

        function applyTelemetryFieldBindings(bindings = {}) {
            if (!dom.telemetryBindingList) return;
            telemetryBindingMeta.forEach((item) => {
                const select = dom.telemetryBindingList.querySelector(`[data-telemetry-slot="${item.key}"]`);
                if (!select) return;
                select.value = bindings[item.key] || telemetryBindingDefaults[item.key] || "";
            });
        }

        function renderMetricCards() {
            const parsed = state.lastParsedFields.filter((field) => field.enabled);
            if (!parsed.length) {
                dom.metricGrid.innerHTML = '<div class="empty-state">先在左侧字段映射中勾选需要验真的字段，收到完整数据帧后这里会自动刷新。</div>';
                return;
            }

            dom.metricGrid.innerHTML = "";
            parsed.forEach((field) => {
                const card = document.createElement("div");
                card.className = "metric-card";
                card.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px ${hexToRgba(field.color, 0.12)}`;
                card.innerHTML = `
                    <div class="label">${escapeHtml(field.name)}</div>
                    <div class="value" style="color:${field.color};">${escapeHtml(String(field.displayValue))}</div>
                    <div class="sub">${escapeHtml(field.rawHex || "--")}</div>
                `;
                dom.metricGrid.appendChild(card);
            });
        }

        function renderPacketHistory() {
            dom.historyHeadRow.innerHTML = "<th>时间</th><th>类型</th><th>结果</th><th>原始帧</th>";

            if (!state.packetHistory.length) {
                dom.packetHistoryBody.innerHTML = '<tr><td colspan="4" class="meta">还没有解析到完整数据帧。</td></tr>';
                return;
            }

            dom.packetHistoryBody.innerHTML = state.packetHistory.map((item) => `
                <tr>
                    <td>${escapeHtml(item.time)}</td>
                    <td>${escapeHtml(item.kind)}</td>
                    <td>${escapeHtml(item.verdict)}</td>
                    <td>${escapeHtml(item.rawHex)}</td>
                </tr>
            `).join("");
        }

        function renderFieldHistory() {
            if (!dom.fieldHistoryBody || !dom.fieldHistoryHeadRow) return;

            const parsed = state.lastParsedFields.filter((field) => field.enabled);
            dom.fieldHistoryHeadRow.innerHTML = "<th>时间</th><th>类型</th>" +
                parsed.map((field) => `<th>${escapeHtml(field.name)}</th>`).join("");

            if (!parsed.length) {
                dom.fieldHistoryBody.innerHTML = '<tr><td colspan="2" class="meta">先在左侧字段映射中勾选需要显示的字段。</td></tr>';
                return;
            }

            if (!state.packetHistory.length) {
                dom.fieldHistoryBody.innerHTML = `<tr><td colspan="${parsed.length + 2}" class="meta">还没有可回看的字段数据。</td></tr>`;
                return;
            }

            dom.fieldHistoryBody.innerHTML = state.packetHistory.map((item) => `
                <tr>
                    <td>${escapeHtml(item.time)}</td>
                    <td>${escapeHtml(item.kind)}</td>
                    ${parsed.map((field) => {
                        const matched = item.fields.find((entry) => entry.name === field.name);
                        return `<td>${escapeHtml(matched ? String(matched.displayValue) : "--")}</td>`;
                    }).join("")}
                </tr>
            `).join("");
        }

        function renderPacketEvents() {
            if (!state.packetEvents.length) {
                dom.packetEventList.innerHTML = '<div class="empty-state">实时接收后，这里会记录帧头对齐、心跳命中、校验失败和重同步过程。</div>';
                return;
            }

            dom.packetEventList.innerHTML = state.packetEvents.map((item) => `
                <div class="event-item ${item.level}">
                    <div class="event-head">
                        <span class="event-title">${escapeHtml(item.title)}</span>
                        <span class="event-time">${escapeHtml(item.time)}</span>
                    </div>
                    <div class="event-detail">${escapeHtml(item.detail)}</div>
                </div>
            `).join("");
        }

        function schedulePacketRender() {
            if (state.packetRenderQueued) return;
            state.packetRenderQueued = true;

            window.requestAnimationFrame(() => {
                state.packetRenderQueued = false;
                renderMetricCards();
                renderPacketHistory();
                renderFieldHistory();
                renderPacketEvents();
                renderProtocolSummary();
                renderTelemetryDashboard();
            });
        }

        function handleProtocolConfigChange() {
            renderProtocolSummary();

            if (!dom.liveParseToggle.checked) {
                dom.packetStatusText.textContent = state.packetBuffer.length
                    ? `实时流解析已暂停，缓冲区累计 ${state.packetBuffer.length} 字节`
                    : "实时流解析已暂停";
                dom.syncState.textContent = state.packetBuffer.length ? "已暂停" : "暂停";
                return;
            }

            if (state.packetBuffer.length) {
                tryParsePackets("config");
            }
        }

        function renderProtocolSummary() {
            const config = getProtocolConfig();
            const error = validateProtocolConfig(config);

            dom.currentModeText.textContent = describeProtocolMode(config);
            dom.bufferBytes.textContent = String(state.packetBuffer.length);
            dom.validFrames.textContent = String(state.packetStats.data);
            dom.heartbeatFrames.textContent = String(state.packetStats.heartbeat);
            dom.invalidFrames.textContent = String(state.packetStats.invalid);
            dom.discardedBytes.textContent = String(state.packetStats.discarded);

            if (error) {
                dom.packetStatusText.textContent = error;
            }
        }

        function describeProtocolMode(config) {
            const modeLabel = config.mode === "tail" ? "帧头 + 帧尾" : "固定长度包";
            const checksumLabel = config.checksumType === "none" ? "无校验" : config.checksumLabel;
            return `${modeLabel} / ${checksumLabel}`;
        }

        function getProtocolConfig() {
            const header = parseHexField(dom.packetHeader.value);
            const footer = parseHexField(dom.packetFooter.value);
            const heartbeat = parseHexField(dom.heartbeatValue.value);
            const checksumType = dom.checksumType.value;

            return {
                mode: dom.parseMode.value,
                frameLength: Number(dom.packetLength.value || 0),
                header,
                footer,
                checksumType,
                checksumLabel: checksumType === "xor8"
                    ? "XOR-8"
                    : checksumType === "sum8"
                        ? "SUM-8"
                        : checksumType === "crc16"
                            ? "CRC16-CCITT"
                            : "无校验",
                checksumLength: checksumType === "crc16" ? 2 : checksumType === "none" ? 0 : 1,
                checksumIncludeHeader: dom.checksumIncludeHeader.checked,
                heartbeat,
                heartbeatOffset: Number(dom.heartbeatOffset.value || 0),
                live: dom.liveParseToggle.checked
            };
        }

        function validateProtocolConfig(config) {
            if (!config.header.valid) return "帧头 HEX 长度必须为偶数";
            if (!config.footer.valid) return "帧尾 HEX 长度必须为偶数";
            if (!config.heartbeat.valid) return "心跳标记 HEX 长度必须为偶数";
            if (!config.frameLength || config.frameLength < 1) return "请先填写正确的总字节数";
            if (config.mode === "tail" && !config.footer.bytes.length) return "帧头 + 帧尾模式必须配置帧尾";
            if (config.heartbeatOffset < 0) return "心跳偏移不能为负数";

            const minLength = minimalFrameLength(config);
            if (config.frameLength < minLength) {
                return `当前总字节数不足，至少需要 ${minLength} 字节`;
            }

            const fieldEnd = maxFieldEnd(getFieldConfigs());
            if (fieldEnd > config.frameLength) {
                return `字段范围越界，总字节数至少要覆盖到 ${fieldEnd} 字节`;
            }

            return "";
        }

        function minimalFrameLength(config) {
            return config.header.bytes.length + config.footer.bytes.length + config.checksumLength;
        }

        function maxFieldEnd(fields) {
            return fields.reduce((max, field) => Math.max(max, field.offset + field.length), 0);
        }

        function validateFrame(frame, config) {
            if (config.header.bytes.length && !sequenceEquals(frame.slice(0, config.header.bytes.length), config.header.bytes)) {
                return {
                    valid: false,
                    summary: "帧头校验失败",
                    detail: "当前帧头部与配置的帧头不一致"
                };
            }

            if (config.footer.bytes.length && !sequenceEquals(frame.slice(frame.length - config.footer.bytes.length), config.footer.bytes)) {
                return {
                    valid: false,
                    summary: "帧尾校验失败",
                    detail: "当前帧尾部与配置的帧尾不一致"
                };
            }

            if (config.checksumType !== "none") {
                const checksumValidation = validateChecksum(frame, config);
                if (!checksumValidation.valid) {
                    return checksumValidation;
                }

                return {
                    valid: true,
                    verdict: "校验通过",
                    detail: checksumValidation.detail
                };
            }

            return {
                valid: true,
                verdict: "结构通过",
                detail: "已通过帧结构验证，当前未启用校验位"
            };
        }

        function validateMk8000Frame(frame, config) {
            if (!sequenceEquals(frame.slice(0, mk8000UartSpec.header.length), mk8000UartSpec.header)) {
                return {
                    valid: false,
                    summary: "帧头不匹配",
                    detail: `收到帧头 ${bytesToHex(frame.slice(0, mk8000UartSpec.header.length))}`
                };
            }

            if (frame[2] !== mk8000UartSpec.cmd) {
                return {
                    valid: false,
                    summary: "命令字不匹配",
                    detail: `收到命令字 0x${frame[2].toString(16).toUpperCase().padStart(2, "0")}`
                };
            }

            if (frame[3] !== mk8000UartSpec.len) {
                return {
                    valid: false,
                    summary: "长度字节不匹配",
                    detail: `收到长度字节 0x${frame[3].toString(16).toUpperCase().padStart(2, "0")}`
                };
            }

            if (frame[frame.length - 1] !== mk8000UartSpec.footer[0]) {
                return {
                    valid: false,
                    summary: "帧尾不匹配",
                    detail: `收到帧尾 0x${frame[frame.length - 1].toString(16).toUpperCase().padStart(2, "0")}`
                };
            }

            const checksumValidation = validateChecksum(frame, config);
            if (!checksumValidation.valid) {
                return checksumValidation;
            }

            return {
                valid: true,
                verdict: "MK8000 帧校验通过",
                detail: `seq ${frame[4]}，crc ${bytesToHex(frame.slice(45, 47))}`
            };
        }

        function validateLegacyMk8000UartFrame(frame) {
            if (!sequenceEquals(frame.slice(0, legacyMk8000UartSpec.header.length), legacyMk8000UartSpec.header)) {
                return {
                    valid: false,
                    summary: "旧版 MK8000 帧头不匹配",
                    detail: `收到帧头 ${bytesToHex(frame.slice(0, legacyMk8000UartSpec.header.length))}`
                };
            }

            if (frame[2] !== legacyMk8000UartSpec.cmd) {
                return {
                    valid: false,
                    summary: "旧版 MK8000 命令字不匹配",
                    detail: `收到命令字 0x${frame[2].toString(16).toUpperCase().padStart(2, "0")}`
                };
            }

            if (frame[3] !== legacyMk8000UartSpec.len) {
                return {
                    valid: false,
                    summary: "旧版 MK8000 长度字节不匹配",
                    detail: `收到长度字节 0x${frame[3].toString(16).toUpperCase().padStart(2, "0")}`
                };
            }

            if (frame[frame.length - 1] !== legacyMk8000UartSpec.footer[0]) {
                return {
                    valid: false,
                    summary: "旧版 MK8000 帧尾不匹配",
                    detail: `收到帧尾 0x${frame[frame.length - 1].toString(16).toUpperCase().padStart(2, "0")}`
                };
            }

            const expected = computeChecksum(frame.slice(2, 35), "crc16");
            const actual = frame.slice(35, 37);
            if (!sequenceEquals(actual, expected)) {
                return {
                    valid: false,
                    summary: "旧版 MK8000 CRC 不匹配",
                    detail: `期望 ${bytesToHex(expected)}，实际 ${bytesToHex(actual)}`
                };
            }

            return {
                valid: true,
                verdict: "旧版 MK8000 帧校验通过",
                detail: `seq ${frame[4]}，crc ${bytesToHex(actual)}`
            };
        }

        function validateLegacyRemoteTpFrame(frame) {
            if (!sequenceEquals(frame.slice(0, legacyRemoteTpSpec.header.length), legacyRemoteTpSpec.header)) {
                return {
                    valid: false,
                    summary: "旧版帧头不匹配",
                    detail: `收到帧头 ${bytesToHex(frame.slice(0, legacyRemoteTpSpec.header.length))}`
                };
            }

            if (frame[2] !== legacyRemoteTpSpec.cmd) {
                return {
                    valid: false,
                    summary: "旧版命令字不匹配",
                    detail: `收到命令字 0x${frame[2].toString(16).toUpperCase().padStart(2, "0")}`
                };
            }

            if (frame[3] !== legacyRemoteTpSpec.len) {
                return {
                    valid: false,
                    summary: "旧版长度字节不匹配",
                    detail: `收到长度字节 0x${frame[3].toString(16).toUpperCase().padStart(2, "0")}`
                };
            }

            if (frame[frame.length - 1] !== legacyRemoteTpSpec.footer[0]) {
                return {
                    valid: false,
                    summary: "旧版帧尾不匹配",
                    detail: `收到帧尾 0x${frame[frame.length - 1].toString(16).toUpperCase().padStart(2, "0")}`
                };
            }

            const expected = computeChecksum(frame.slice(2, 34), "crc16");
            const actual = frame.slice(34, 36);
            if (!sequenceEquals(actual, expected)) {
                return {
                    valid: false,
                    summary: "旧版 CRC 不匹配",
                    detail: `期望 ${bytesToHex(expected)}，实际 ${bytesToHex(actual)}`
                };
            }

            return {
                valid: true,
                verdict: "旧版 remote_tp 帧校验通过",
                detail: `seq ${frame[4]}，crc ${bytesToHex(actual)}`
            };
        }

        function validateChecksum(frame, config) {
            const range = getChecksumWindow(frame, config);
            if (!range) {
                return {
                    valid: false,
                    summary: "校验配置越界",
                    detail: "当前帧长度无法同时容纳帧头、有效载荷、校验和帧尾"
                };
            }

            const payload = frame.slice(range.dataStart, range.dataEnd);
            const expected = computeChecksum(payload, config.checksumType);
            const actual = frame.slice(range.checksumStart, range.checksumEnd);

            if (!sequenceEquals(actual, expected)) {
                return {
                    valid: false,
                    summary: "校验失败",
                    detail: `期望 ${bytesToHex(expected)}，实际 ${bytesToHex(actual)}`
                };
            }

            return {
                valid: true,
                detail: `校验通过，值为 ${bytesToHex(actual)}`
            };
        }

        function getChecksumWindow(frame, config) {
            const footerStart = frame.length - config.footer.bytes.length;
            const checksumEnd = footerStart;
            const checksumStart = checksumEnd - config.checksumLength;
            const dataStart = config.checksumIncludeHeader ? 0 : config.header.bytes.length;

            if (config.checksumLength <= 0) return null;
            if (checksumStart < dataStart) return null;

            return {
                dataStart,
                dataEnd: checksumStart,
                checksumStart,
                checksumEnd
            };
        }

        function computeChecksum(bytes, type) {
            if (type === "xor8") {
                const value = bytes.reduce((result, byte) => result ^ byte, 0);
                return [value & 0xFF];
            }

            if (type === "sum8") {
                const value = bytes.reduce((result, byte) => result + byte, 0) & 0xFF;
                return [value];
            }

            if (type === "crc16") {
                let crc = 0x0000;
                bytes.forEach((byte) => {
                    crc ^= (byte << 8);
                    for (let i = 0; i < 8; i += 1) {
                        if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
                        else crc = (crc << 1) & 0xFFFF;
                    }
                });
                return [crc & 0xFF, (crc >> 8) & 0xFF];
            }

            return [];
        }

        function classifyFrame(frame, config) {
            if (!config.heartbeat.bytes.length) return "data";
            const slice = frame.slice(config.heartbeatOffset, config.heartbeatOffset + config.heartbeat.bytes.length);
            return sequenceEquals(slice, config.heartbeat.bytes) ? "heartbeat" : "data";
        }

        function dropInvalidBytes(config) {
            const shouldSlide = config.header.bytes.length || config.mode === "tail" || config.footer.bytes.length;
            const dropCount = shouldSlide ? 1 : Math.min(config.frameLength || 1, state.packetBuffer.length);
            state.packetBuffer.splice(0, dropCount);
            return dropCount;
        }

        async function sendMessage(isAuto) {
            if (!state.port || !state.port.writable) {
                alert("请先连接串口。");
                dom.autoSendToggle.checked = false;
                stopAutoSend();
                return;
            }

            if (state.isWriting) {
                return;
            }

            let writer = null;
            try {
                const format = dom.sendFormat.value;
                const payloadText = dom.sendInput.value.trim();
                const lineEnding = dom.lineEnding.value;
                let payloadBytes;

                if (format === "hex") {
                    payloadBytes = Uint8Array.from(parseHexInput(payloadText, false));
                } else {
                    payloadBytes = new TextEncoder().encode(payloadText + lineEnding);
                }

                state.isWriting = true;
                writer = state.port.writable.getWriter();
                await writer.write(payloadBytes);
                appendSerialLog("tx", payloadBytes);
                pushSendHistory(payloadText, format, dom.sendNote.value.trim());

                if (!isAuto) {
                    dom.sendNote.value = "";
                }
            } catch (error) {
                console.error(error);
                stopAutoSend();
                alert(`发送失败: ${error.message}`);
            } finally {
                if (writer) {
                    writer.releaseLock();
                }
                state.isWriting = false;
            }
        }

        function handleAutoSendToggle() {
            if (dom.autoSendToggle.checked) {
                const interval = Number(dom.autoSendInterval.value);
                if (!interval || interval < 20) {
                    alert("自动发送周期建议不小于 20ms。");
                    dom.autoSendToggle.checked = false;
                    return;
                }

                stopAutoSend();
                state.autoSendTimer = window.setInterval(() => sendMessage(true), interval);
                dom.stopAutoSendBtn.disabled = false;
                appendSerialLog("system", `自动发送已启动，周期 ${interval} ms`);
            } else {
                stopAutoSend();
            }
        }

        function stopAutoSend() {
            if (state.autoSendTimer) {
                window.clearInterval(state.autoSendTimer);
                state.autoSendTimer = null;
                appendSerialLog("system", "自动发送已停止");
            }
            dom.autoSendToggle.checked = false;
            dom.stopAutoSendBtn.disabled = true;
        }

        function appendSerialLog(kind, payload) {
            const time = new Date();
            const normalizedPayload = payload instanceof Uint8Array ? Array.from(payload) : payload;
            const lastEntry = state.serialLogEntries[state.serialLogEntries.length - 1];

            if (
                (kind === "rx" || kind === "tx") &&
                lastEntry &&
                lastEntry.kind === kind &&
                Array.isArray(lastEntry.payload) &&
                Array.isArray(normalizedPayload) &&
                lastEntry.payload.length + normalizedPayload.length <= 4096 &&
                time.getTime() - Date.parse(lastEntry.timestamp) <= 80
            ) {
                lastEntry.payload.push(...normalizedPayload);
                lastEntry.timestamp = time.toISOString();
                scheduleSerialLogRender();
                return;
            }

            state.serialLogEntries.push({
                kind,
                timestamp: time.toISOString(),
                payload: normalizedPayload
            });
            state.serialLogEntries = state.serialLogEntries.slice(-300);
            scheduleSerialLogRender();
        }

        function scheduleSerialLogRender() {
            if (state.serialLogRenderQueued) return;
            state.serialLogRenderQueued = true;

            window.requestAnimationFrame(() => {
                state.serialLogRenderQueued = false;
                renderSerialLog();
            });
        }

        function renderSerialLog() {
            const showTx = dom.showTxToggle.checked;
            const showRx = dom.showRxToggle.checked;
            const mode = dom.receiveViewMode.value;

            const visibleEntries = state.serialLogEntries.filter((entry) => {
                if (entry.kind === "tx" && !showTx) return false;
                if (entry.kind === "rx" && !showRx) return false;
                return true;
            });

            if (!visibleEntries.length) {
                dom.serialLog.innerHTML = '<div class="empty-state">这里会显示串口收发内容和系统提示。</div>';
                return;
            }

            dom.serialLog.innerHTML = visibleEntries.map((entry) => {
                const ts = renderTimestamp(entry.timestamp);
                let label = "系统";
                let kindClass = "log-kind-system";
                let payload = typeof entry.payload === "string" ? entry.payload : "";
                let bodyClass = "ascii";

                if (entry.kind === "rx") {
                    label = "RX";
                    kindClass = "log-kind-rx";
                    payload = mode === "hex" ? formatHexBlock(entry.payload) : bytesToAscii(entry.payload);
                    bodyClass = mode;
                } else if (entry.kind === "tx") {
                    label = "TX";
                    kindClass = "log-kind-tx";
                    payload = mode === "hex" ? formatHexBlock(entry.payload) : bytesToAscii(entry.payload);
                    bodyClass = mode;
                }

                return `
                    <div class="log-entry log-entry-${entry.kind}">
                        <div class="log-head">
                            <span class="log-kind ${kindClass}">${label}</span>
                            <span class="log-ts">${escapeHtml(ts)}</span>
                        </div>
                        <div class="log-body ${bodyClass}">${escapeHtml(payload)}</div>
                    </div>
                `;
            }).join("");

            if (dom.autoScrollToggle.checked) {
                dom.serialLog.scrollTop = dom.serialLog.scrollHeight;
            }
        }

        function exportSerialLog() {
            const content = state.serialLogEntries.map((entry) => {
                const ts = renderTimestamp(entry.timestamp);
                const payload = typeof entry.payload === "string" ? entry.payload : bytesToHex(entry.payload);
                return `${ts} [${entry.kind.toUpperCase()}] ${payload}`;
            }).join("\n");

            const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `serial-log-${Date.now()}.txt`;
            link.click();
            URL.revokeObjectURL(url);
        }

        function renderTimestamp(iso) {
            const date = new Date(iso);
            const mode = dom.timestampMode.value;
            if (mode === "none") return "";
            if (mode === "time") return formatDisplayTime(date, false);
            return formatDisplayTime(date, true);
        }

        function formatDisplayTime(date, withMs) {
            const hh = String(date.getHours()).padStart(2, "0");
            const mm = String(date.getMinutes()).padStart(2, "0");
            const ss = String(date.getSeconds()).padStart(2, "0");
            if (!withMs) return `${hh}:${mm}:${ss}`;
            const ms = String(date.getMilliseconds()).padStart(3, "0");
            return `${hh}:${mm}:${ss}.${ms}`;
        }

        function pushSendHistory(payload, format, note) {
            if (!payload) return;
            const item = { payload, format, note };
            state.sendHistory = [item, ...state.sendHistory.filter((entry) => entry.payload !== payload || entry.format !== format)].slice(0, 8);
            renderSendHistory();
        }

        function renderSendHistory() {
            if (!state.sendHistory.length) {
                dom.sendHistory.innerHTML = '<div class="empty-state">发过的指令会保存在这里，方便重复联调。</div>';
                return;
            }

            dom.sendHistory.innerHTML = "";
            state.sendHistory.forEach((item) => {
                const button = document.createElement("button");
                button.className = "history-pill";
                button.textContent = item.note ? `${item.note}: ${item.payload}` : `${item.format.toUpperCase()}: ${item.payload}`;
                button.addEventListener("click", () => {
                    dom.sendFormat.value = item.format;
                    dom.sendInput.value = item.payload;
                    dom.sendNote.value = item.note;
                });
                dom.sendHistory.appendChild(button);
            });
        }

        function simulateFrame() {
            const config = getProtocolConfig();
            const error = validateProtocolConfig(config);
            if (error) {
                alert(error);
                return;
            }

            try {
                const frame = buildSimulatedFrame(config, getFieldConfigs());
                clearSimulationTimers();
                dom.packetStatusText.textContent = "正在模拟串口流入...";
                appendSerialLog("system", "已开始模拟流式入包");
                injectFrameAsStream(frame);
            } catch (simulationError) {
                alert(simulationError.message);
            }
        }

        function buildSimulatedFrame(config, fields) {
            if (isMk8000ProtocolConfig(config)) {
                return buildMk8000SimulatedFrame();
            }
            const frameLength = Math.max(config.frameLength, minimalFrameLength(config), maxFieldEnd(fields));
            const frame = new Array(frameLength).fill(0).map(() => Math.floor(Math.random() * 256));

            writeBytesIntoFrame(frame, 0, config.header.bytes);
            if (config.footer.bytes.length) {
                writeBytesIntoFrame(frame, frame.length - config.footer.bytes.length, config.footer.bytes);
            }

            fields.forEach((field) => {
                if (field.offset >= frame.length) return;

                switch (field.type) {
                    case "u8":
                    case "s8":
                        writeBytesIntoFrame(frame, field.offset, [Math.floor(Math.random() * 100)]);
                        break;
                    case "u16le":
                        writeNumberToFrame(frame, field.offset, field.length, (Math.random() * 600 + 200) | 0, "setUint16", true);
                        break;
                    case "u16be":
                        writeNumberToFrame(frame, field.offset, field.length, (Math.random() * 600 + 200) | 0, "setUint16", false);
                        break;
                    case "s16le":
                        writeNumberToFrame(frame, field.offset, field.length, ((Math.random() * 400) - 100) | 0, "setInt16", true);
                        break;
                    case "s16be":
                        writeNumberToFrame(frame, field.offset, field.length, ((Math.random() * 400) - 100) | 0, "setInt16", false);
                        break;
                    case "u32le":
                        writeNumberToFrame(frame, field.offset, field.length, (Math.random() * 5000 + 1000) | 0, "setUint32", true);
                        break;
                    case "u32be":
                        writeNumberToFrame(frame, field.offset, field.length, (Math.random() * 5000 + 1000) | 0, "setUint32", false);
                        break;
                    case "floatle":
                        writeNumberToFrame(frame, field.offset, field.length, Math.random() * 100, "setFloat32", true);
                        break;
                    case "floatbe":
                        writeNumberToFrame(frame, field.offset, field.length, Math.random() * 100, "setFloat32", false);
                        break;
                    case "ascii": {
                        const label = "SIM";
                        const bytes = Array.from({ length: field.length }, (_, index) => label.charCodeAt(index % label.length));
                        writeBytesIntoFrame(frame, field.offset, bytes);
                        break;
                    }
                    default:
                        break;
                }
            });

            if (config.heartbeat.bytes.length && Math.random() > 0.65) {
                writeBytesIntoFrame(frame, config.heartbeatOffset, config.heartbeat.bytes);
            }

            if (config.checksumType !== "none") {
                const range = getChecksumWindow(frame, config);
                if (!range) {
                    throw new Error("当前配置无法生成模拟帧，请检查校验位位置。");
                }
                const checksum = computeChecksum(frame.slice(range.dataStart, range.dataEnd), config.checksumType);
                writeBytesIntoFrame(frame, range.checksumStart, checksum);
            }

            return frame;
        }

        function injectFrameAsStream(frame) {
            let cursor = 0;
            let delay = 0;

            while (cursor < frame.length) {
                const chunkSize = Math.min(frame.length - cursor, Math.max(1, Math.floor(Math.random() * 4) + 1));
                const chunk = frame.slice(cursor, cursor + chunkSize);
                const timer = window.setTimeout(() => {
                    handleIncomingBytes(Uint8Array.from(chunk), "simulate");
                }, delay);

                state.simulationTimers.push(timer);
                cursor += chunkSize;
                delay += 60 + Math.floor(Math.random() * 120);
            }
        }

        function clearSimulationTimers() {
            state.simulationTimers.forEach((timer) => window.clearTimeout(timer));
            state.simulationTimers = [];
        }

        function writeBytesIntoFrame(frame, offset, bytes) {
            bytes.forEach((byte, index) => {
                if (offset + index < frame.length) {
                    frame[offset + index] = byte;
                }
            });
        }

        function writeNumberToFrame(frame, offset, length, value, method, littleEndian) {
            if (![2, 4].includes(length)) return;
            const buffer = new ArrayBuffer(length);
            const view = new DataView(buffer);
            view[method](0, value, littleEndian);
            writeBytesIntoFrame(frame, offset, Array.from(new Uint8Array(buffer)));
        }

        function resetPacketWorkspace() {
            clearSimulationTimers();
            state.packetBuffer = [];
            state.packetHistory = [];
            state.packetEvents = [];
            state.packetStats = {
                data: 0,
                heartbeat: 0,
                invalid: 0,
                discarded: 0
            };
            state.lastFrameHex = "";
            state.lastFrameBytes = [];
            state.lastParsedFields = [];
            state.lastUwbTelemetry = null;
            state.lastMk8000Seq = null;
            dom.packetHexPreview.value = "";
            renderTelemetryDashboard();
            dom.packetStatusText.textContent = "等待实时数据...";
            dom.syncState.textContent = "未同步";
            renderMetricCards();
            renderPacketEvents();
            renderPacketHistory();
            renderFieldHistory();
            renderProtocolSummary();
            appendSerialLog("system", "数据包工作台已清空流状态");
        }

        function saveTemplate() {
            const name = dom.templateName.value.trim();
            if (!name) {
                alert("先填写模板名称再保存。");
                return;
            }

            const template = {
                parseMode: dom.parseMode.value,
                packetLength: Number(dom.packetLength.value),
                packetHeader: dom.packetHeader.value.trim(),
                packetFooter: dom.packetFooter.value.trim(),
                checksumType: dom.checksumType.value,
                checksumIncludeHeader: dom.checksumIncludeHeader.checked,
                heartbeatOffset: Number(dom.heartbeatOffset.value || 0),
                heartbeatValue: dom.heartbeatValue.value.trim(),
                liveParse: dom.liveParseToggle.checked,
                telemetryBindingMode: dom.telemetryBindingMode ? dom.telemetryBindingMode.value : "fixed",
                telemetryBindings: getTelemetryFieldBindings(),
                fields: getFieldConfigs()
            };
            localStorage.setItem(`pulse-template:${name}`, JSON.stringify(template));
            appendSerialLog("system", `模板已保存: ${name}`);
        }

        function loadTemplate() {
            const keys = Object.keys(localStorage).filter((key) => key.startsWith("pulse-template:"));
            if (!keys.length) {
                alert("本地还没有保存过模板。");
                return;
            }

            const names = keys.map((key) => key.replace("pulse-template:", ""));
            const selected = prompt(`可用模板：\n${names.join("\n")}\n\n请输入要载入的模板名称`, names[0]);
            if (!selected) return;

            const raw = localStorage.getItem(`pulse-template:${selected}`);
            if (!raw) {
                alert("没有找到对应模板。");
                return;
            }

            const template = JSON.parse(raw);
            dom.templateName.value = selected;
            dom.parseMode.value = template.parseMode || "fixed";
            dom.packetLength.value = template.packetLength || 12;
            dom.packetHeader.value = template.packetHeader || "";
            dom.packetFooter.value = template.packetFooter || "";
            dom.checksumType.value = template.checksumType || "none";
            dom.checksumIncludeHeader.checked = template.checksumIncludeHeader ?? true;
            dom.heartbeatOffset.value = template.heartbeatOffset ?? 0;
            dom.heartbeatValue.value = template.heartbeatValue || "";
            dom.liveParseToggle.checked = template.liveParse ?? true;
            if (dom.telemetryBindingMode) {
                dom.telemetryBindingMode.value = template.telemetryBindingMode || "fixed";
            }
            renderFieldTable(template.fields || []);
            applyTelemetryFieldBindings(template.telemetryBindings || telemetryBindingDefaults);
            resetPacketWorkspace();
            appendSerialLog("system", `模板已载入: ${selected}`);
        }

        function pushPacketEvent(level, title, detail) {
            state.packetEvents.unshift({
                level,
                title,
                detail,
                time: formatDisplayTime(new Date(), true)
            });
            state.packetEvents = state.packetEvents.slice(0, 16);
            schedulePacketRender();
        }

        function parseHexField(text) {
            const cleaned = text.replace(/[^0-9a-fA-F]/g, "");
            if (!cleaned) {
                return {
                    raw: text,
                    bytes: [],
                    valid: !text.trim()
                };
            }

            if (cleaned.length % 2 !== 0) {
                return {
                    raw: text,
                    bytes: [],
                    valid: false
                };
            }

            return {
                raw: text,
                bytes: parseHexInput(text, false),
                valid: true
            };
        }

        function parseHexInput(text, silent) {
            const cleaned = text.replace(/[^0-9a-fA-F]/g, "");
            if (!cleaned) return [];
            if (cleaned.length % 2 !== 0) {
                if (!silent) throw new Error("HEX 字符串长度必须是偶数。");
                return [];
            }

            const result = [];
            for (let i = 0; i < cleaned.length; i += 2) {
                result.push(parseInt(cleaned.slice(i, i + 2), 16));
            }
            return result;
        }

        function bytesToHex(bytes) {
            return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(" ");
        }

        function formatHexBlock(bytes, lineSize = 16) {
            const parts = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0").toUpperCase());
            const lines = [];
            for (let i = 0; i < parts.length; i += lineSize) {
                lines.push(parts.slice(i, i + lineSize).join(" "));
            }
            return lines.join("\n");
        }

        function bytesToAscii(bytes) {
            return Array.from(bytes).map((byte) => {
                if (byte >= 32 && byte <= 126) return String.fromCharCode(byte);
                if (byte === 10) return "\\n";
                if (byte === 13) return "\\r";
                return ".";
            }).join("");
        }

        function findSequenceIndex(buffer, target, startIndex = 0) {
            if (!target.length) return 0;

            for (let i = startIndex; i <= buffer.length - target.length; i += 1) {
                let matched = true;
                for (let j = 0; j < target.length; j += 1) {
                    if (buffer[i + j] !== target[j]) {
                        matched = false;
                        break;
                    }
                }
                if (matched) return i;
            }

            return -1;
        }

        function sequenceEquals(a, b) {
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i += 1) {
                if (a[i] !== b[i]) return false;
            }
            return true;
        }

        function escapeHtml(value) {
            return String(value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;");
        }

        function hexToRgba(hex, alpha) {
            const cleaned = hex.replace("#", "");
            const value = parseInt(cleaned, 16);
            const r = (value >> 16) & 255;
            const g = (value >> 8) & 255;
            const b = value & 255;
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        function applyMk8000Template() {
            renderFieldTable([
                { name: "SOF", offset: 0, length: 2, type: "hex", scale: 1, bias: 0, unit: "", enabled: false },
                { name: "CMD", offset: 2, length: 1, type: "u8", scale: 1, bias: 0, unit: "", enabled: false },
                { name: "LEN", offset: 3, length: 1, type: "u8", scale: 1, bias: 0, unit: "", enabled: false },
                { name: "SEQ", offset: 4, length: 1, type: "u8", scale: 1, bias: 0, unit: "", enabled: true },
                { name: "MODE", offset: 5, length: 1, type: "u8", scale: 1, bias: 0, unit: "", enabled: true },
                { name: "DIST_SET", offset: 6, length: 1, type: "u8", scale: 1, bias: 0, unit: "m", enabled: true },
                { name: "KEY_BITMAP", offset: 7, length: 2, type: "u16le", scale: 1, bias: 0, unit: "", enabled: true },
                { name: "JOY_X", offset: 9, length: 1, type: "s8", scale: 1, bias: 0, unit: "", enabled: true },
                { name: "JOY_Y", offset: 10, length: 1, type: "s8", scale: 1, bias: 0, unit: "", enabled: true },
                { name: "VOICE_CMD", offset: 11, length: 2, type: "u16le", scale: 1, bias: 0, unit: "", enabled: true },
                { name: "UWB_DIST", offset: 13, length: 2, type: "u16le", scale: 1, bias: 0, unit: "cm", enabled: true },
                { name: "UWB_ANGLE", offset: 15, length: 2, type: "s16le", scale: 1, bias: 0, unit: "deg", enabled: true },
                { name: "AZ_FOM", offset: 17, length: 1, type: "u8", scale: 1, bias: 0, unit: "", enabled: true },
                { name: "ACC_X", offset: 18, length: 2, type: "s16le", scale: 1, bias: 0, unit: "", enabled: false },
                { name: "ACC_Y", offset: 20, length: 2, type: "s16le", scale: 1, bias: 0, unit: "", enabled: false },
                { name: "ACC_Z", offset: 22, length: 2, type: "s16le", scale: 1, bias: 0, unit: "", enabled: false },
                { name: "GYRO_X", offset: 24, length: 2, type: "s16le", scale: 1, bias: 0, unit: "", enabled: false },
                { name: "GYRO_Y", offset: 26, length: 2, type: "s16le", scale: 1, bias: 0, unit: "", enabled: false },
                { name: "GYRO_Z", offset: 28, length: 2, type: "s16le", scale: 1, bias: 0, unit: "", enabled: false },
                { name: "LINK_STATE", offset: 30, length: 1, type: "u8", scale: 1, bias: 0, unit: "", enabled: true },
                { name: "FLAGS", offset: 31, length: 1, type: "u8", scale: 1, bias: 0, unit: "", enabled: true },
                { name: "PROTO_VER", offset: 32, length: 1, type: "u8", scale: 1, bias: 0, unit: "", enabled: false },
                { name: "PAIR_ID", offset: 33, length: 1, type: "u8", scale: 1, bias: 0, unit: "", enabled: true },
                { name: "PAIR_STATUS", offset: 34, length: 1, type: "u8", scale: 1, bias: 0, unit: "", enabled: true },
                { name: "UWB_ELEV", offset: 35, length: 2, type: "s16le", scale: 1, bias: 0, unit: "deg", enabled: true },
                { name: "ELE_FOM", offset: 37, length: 1, type: "u8", scale: 1, bias: 0, unit: "", enabled: true },
                { name: "RESERVED_38", offset: 38, length: 1, type: "u8", scale: 1, bias: 0, unit: "", enabled: false },
                { name: "RESERVED_39", offset: 39, length: 1, type: "u8", scale: 1, bias: 0, unit: "", enabled: false },
                { name: "RESERVED_40", offset: 40, length: 1, type: "u8", scale: 1, bias: 0, unit: "", enabled: false },
                { name: "RESERVED_41", offset: 41, length: 1, type: "u8", scale: 1, bias: 0, unit: "", enabled: false },
                { name: "FINAL_RX_RATE", offset: 42, length: 1, type: "u8", scale: 1, bias: 0, unit: "%", enabled: true },
                { name: "RANGING_RATE", offset: 43, length: 1, type: "u8", scale: 1, bias: 0, unit: "%", enabled: true },
                { name: "LINK_QUALITY", offset: 44, length: 1, type: "u8", scale: 1, bias: 0, unit: "%", enabled: true },
                { name: "CRC", offset: 45, length: 2, type: "hex", scale: 1, bias: 0, unit: "", enabled: false },
                { name: "EOF", offset: 47, length: 1, type: "hex", scale: 1, bias: 0, unit: "", enabled: false }
            ]);

            dom.packetLength.value = String(mk8000UartSpec.frameLength);
            dom.packetHeader.value = "A566";
            dom.packetFooter.value = "FD";
            dom.checksumType.value = "crc16";
            dom.checksumIncludeHeader.checked = false;
            dom.heartbeatValue.value = "";
            dom.heartbeatOffset.value = "0";
            dom.baudRate.value = "115200";
            if (dom.telemetryBindingMode) {
                dom.telemetryBindingMode.value = "fixed";
            }
            renderTelemetryBindingControls(telemetryBindingDefaults);
            applyTelemetryFieldBindings(telemetryBindingDefaults);
        }

        function isMk8000ProtocolConfig(config) {
            return config.frameLength === mk8000UartSpec.frameLength &&
                sequenceEquals(config.header.bytes, mk8000UartSpec.header) &&
                sequenceEquals(config.footer.bytes, mk8000UartSpec.footer) &&
                config.checksumType === "crc16" &&
                config.checksumIncludeHeader === false;
        }

        function buildMk8000SimulatedFrame() {
            const frame = new Array(mk8000UartSpec.frameLength).fill(0);
            const mode = Math.floor(Math.random() * 4);
            const distSet = [3, 5, 8, 10][Math.floor(Math.random() * 4)];
            const distance = 80 + Math.floor(Math.random() * 420);
            const angle = -70 + Math.floor(Math.random() * 141);
            const elevation = -35 + Math.floor(Math.random() * 71);
            const joyX = -100 + Math.floor(Math.random() * 201);
            const joyY = -100 + Math.floor(Math.random() * 201);
            const keyPool = [0x0000, 0x0001, 0x0002, 0x0004];
            const keyBitmap = keyPool[Math.floor(Math.random() * keyPool.length)];
            const voiceCmd = Math.random() > 0.7 ? (0x1000 + Math.floor(Math.random() * 16)) : 0;
            const fom = 55 + Math.floor(Math.random() * 45);
            const elevationFom = 50 + Math.floor(Math.random() * 50);
            const imuEnabled = Math.random() > 0.2;
            const flags = mk8000UartSpec.flagDistValid |
                mk8000UartSpec.flagAngleValid |
                (voiceCmd ? mk8000UartSpec.flagVoiceValid : 0) |
                (imuEnabled ? mk8000UartSpec.flagImuValid : 0);

            frame[0] = mk8000UartSpec.header[0];
            frame[1] = mk8000UartSpec.header[1];
            frame[2] = mk8000UartSpec.cmd;
            frame[3] = mk8000UartSpec.len;
            frame[4] = Math.floor(Math.random() * 255);
            frame[5] = mode;
            frame[6] = distSet;
            writeU16LE(frame, 7, keyBitmap);
            writeS8(frame, 9, joyX);
            writeS8(frame, 10, joyY);
            writeU16LE(frame, 11, voiceCmd);
            writeU16LE(frame, 13, distance);
            writeS16LE(frame, 15, angle);
            frame[17] = fom;
            writeS16LE(frame, 18, imuEnabled ? (-1800 + Math.floor(Math.random() * 3601)) : 0);
            writeS16LE(frame, 20, imuEnabled ? (-1800 + Math.floor(Math.random() * 3601)) : 0);
            writeS16LE(frame, 22, imuEnabled ? (-1800 + Math.floor(Math.random() * 3601)) : 0);
            writeS16LE(frame, 24, imuEnabled ? (-900 + Math.floor(Math.random() * 1801)) : 0);
            writeS16LE(frame, 26, imuEnabled ? (-900 + Math.floor(Math.random() * 1801)) : 0);
            writeS16LE(frame, 28, imuEnabled ? (-900 + Math.floor(Math.random() * 1801)) : 0);
            frame[30] = mk8000UartSpec.linkOk;
            frame[31] = flags;
            frame[32] = 0x01;
            frame[33] = 0x24;
            frame[34] = Math.random() > 0.75 ? mk8000UartSpec.pairStatusPairing : mk8000UartSpec.pairStatusPaired;
            writeS16LE(frame, 35, elevation);
            frame[37] = elevationFom;
            frame[42] = 92 + Math.floor(Math.random() * 9);
            frame[43] = 88 + Math.floor(Math.random() * 13);
            frame[44] = 80 + Math.floor(Math.random() * 21);

            const checksum = computeChecksum(frame.slice(2, 45), "crc16");
            writeBytesIntoFrame(frame, 45, checksum);
            frame[47] = mk8000UartSpec.footer[0];
            return frame;
        }

        function extractMk8000Telemetry(frame) {
            if (!frame || frame.length !== mk8000UartSpec.frameLength) return null;
            if (!sequenceEquals(frame.slice(0, 2), mk8000UartSpec.header)) return null;
            if (frame[2] !== mk8000UartSpec.cmd || frame[3] !== mk8000UartSpec.len || frame[47] !== mk8000UartSpec.footer[0]) return null;

            const view = new DataView(Uint8Array.from(frame).buffer);
            const keyBitmap = view.getUint16(7, true);
            const flags = view.getUint8(31);
            const hasDist = Boolean(flags & mk8000UartSpec.flagDistValid);
            const hasAngle = Boolean(flags & mk8000UartSpec.flagAngleValid);
            const voiceCmd = view.getUint16(11, true);
            const hasVoice = Boolean(flags & mk8000UartSpec.flagVoiceValid) || voiceCmd !== 0;
            const hasImu = Boolean(flags & mk8000UartSpec.flagImuValid);
            const hasPairing = Boolean(flags & mk8000UartSpec.flagPairing);

            return {
                seq: view.getUint8(4),
                mode: view.getUint8(5),
                modeLabel: describeMode(view.getUint8(5)),
                distSet: view.getUint8(6),
                keyBitmap,
                joyX: view.getInt8(9),
                joyY: view.getInt8(10),
                voiceCmd,
                voiceBytes: [view.getUint8(11), view.getUint8(12)],
                distanceCm: view.getUint16(13, true),
                angleDeg: view.getInt16(15, true),
                fom: view.getUint8(17),
                accX: view.getInt16(18, true),
                accY: view.getInt16(20, true),
                accZ: view.getInt16(22, true),
                gyroX: view.getInt16(24, true),
                gyroY: view.getInt16(26, true),
                gyroZ: view.getInt16(28, true),
                linkState: view.getUint8(30),
                flags,
                hasDist,
                hasAngle,
                hasVoice,
                hasImu,
                protoVer: view.getUint8(32),
                pairId: view.getUint8(33),
                pairStatus: view.getUint8(34),
                pairStatusLabel: describePairStatus(view.getUint8(34)),
                elevationDeg: view.getInt16(35, true),
                elevationFom: view.getUint8(37),
                finalRxRate: view.getUint8(42),
                rangingRate: view.getUint8(43),
                linkQuality: view.getUint8(44),
                hasPairing,
                keyNames: describeKeys(keyBitmap),
                flagNames: describeFlags(flags)
            };
        }

        function normalizeLegacyRemoteTpFrame(frame) {
            const normalized = new Array(mk8000UartSpec.frameLength).fill(0);

            normalized[0] = mk8000UartSpec.header[0];
            normalized[1] = mk8000UartSpec.header[1];
            normalized[2] = mk8000UartSpec.cmd;
            normalized[3] = mk8000UartSpec.len;
            normalized[4] = frame[4];
            normalized[5] = frame[5];
            normalized[6] = frame[6];
            normalized[7] = frame[7];
            normalized[8] = frame[8];
            writeS8(normalized, 9, clamp(readS16LE(frame, 9), -127, 127));
            writeS8(normalized, 10, clamp(readS16LE(frame, 11), -127, 127));
            normalized[11] = frame[13];
            normalized[12] = frame[14];
            normalized[13] = frame[15];
            normalized[14] = frame[16];
            normalized[15] = frame[17];
            normalized[16] = frame[18];
            normalized[17] = 0;
            copyFrameBytes(frame, 19, normalized, 18, 6);
            copyFrameBytes(frame, 25, normalized, 24, 6);
            normalized[30] = frame[31];
            normalized[31] = frame[32];
            normalized[32] = frame[33];
            normalized[33] = 0;
            normalized[34] = 0;

            const checksum = computeChecksum(normalized.slice(2, 45), "crc16");
            normalized[45] = checksum[0];
            normalized[46] = checksum[1];
            normalized[47] = mk8000UartSpec.footer[0];
            return normalized;
        }

        function normalizeLegacyMk8000UartFrame(frame) {
            const normalized = new Array(mk8000UartSpec.frameLength).fill(0);
            copyFrameBytes(frame, 0, normalized, 0, Math.min(frame.length, 35));
            normalized[3] = mk8000UartSpec.len;

            const checksum = computeChecksum(normalized.slice(2, 45), "crc16");
            normalized[45] = checksum[0];
            normalized[46] = checksum[1];
            normalized[47] = mk8000UartSpec.footer[0];
            return normalized;
        }

        function resolveTelemetryDashboardData() {
            if (dom.telemetryBindingMode && dom.telemetryBindingMode.value === "field") {
                return extractTelemetryFromBindings(state.lastParsedFields, getTelemetryFieldBindings());
            }
            return extractMk8000Telemetry(state.lastFrameBytes);
        }

        function extractTelemetryFromBindings(fields, bindings) {
            if (!fields || !fields.length) return null;

            const readInt = (key) => {
                const field = findParsedFieldByName(fields, bindings[key]);
                const value = getParsedFieldNumericValue(field);
                return Number.isFinite(value) ? Math.round(value) : null;
            };
            const readNumber = (key) => {
                const field = findParsedFieldByName(fields, bindings[key]);
                const value = getParsedFieldNumericValue(field);
                return Number.isFinite(value) ? value : null;
            };

            const data = {
                seq: readInt("seq"),
                mode: readInt("mode"),
                distSet: readNumber("distSet"),
                keyBitmap: readInt("keyBitmap"),
                joyX: readNumber("joyX"),
                joyY: readNumber("joyY"),
                voiceCmd: readInt("voiceCmd"),
                voiceBytes: null,
                distanceCm: readNumber("distanceCm"),
                angleDeg: readNumber("angleDeg"),
                elevationDeg: readNumber("elevationDeg"),
                fom: readNumber("fom"),
                elevationFom: readNumber("elevationFom"),
                accX: readNumber("accX"),
                accY: readNumber("accY"),
                accZ: readNumber("accZ"),
                gyroX: readNumber("gyroX"),
                gyroY: readNumber("gyroY"),
                gyroZ: readNumber("gyroZ"),
                linkState: readInt("linkState"),
                flags: readInt("flags"),
                protoVer: readInt("protoVer"),
                pairId: readInt("pairId"),
                pairStatus: readInt("pairStatus")
            };

            const hasAny = Object.values(data).some((value) => Number.isFinite(value));
            if (!hasAny) return null;

            return {
                ...data,
                modeLabel: Number.isFinite(data.mode) ? describeMode(data.mode) : "--",
                keyNames: Number.isFinite(data.keyBitmap) ? describeKeys(data.keyBitmap) : [],
                flagNames: Number.isFinite(data.flags) ? describeFlags(data.flags) : [],
                pairStatusLabel: Number.isFinite(data.pairStatus) ? describePairStatus(data.pairStatus) : "--",
                hasPairing: Number.isFinite(data.flags) ? Boolean(data.flags & mk8000UartSpec.flagPairing) : false,
                hasDist: Number.isFinite(data.flags) ? Boolean(data.flags & mk8000UartSpec.flagDistValid) : Number.isFinite(data.distanceCm),
                hasAngle: Number.isFinite(data.flags) ? Boolean(data.flags & mk8000UartSpec.flagAngleValid) : Number.isFinite(data.angleDeg),
                hasVoice: Number.isFinite(data.voiceCmd) && data.voiceCmd !== 0,
                hasImu: Number.isFinite(data.flags) ? Boolean(data.flags & mk8000UartSpec.flagImuValid) : (
                    Number.isFinite(data.accX) ||
                    Number.isFinite(data.accY) ||
                    Number.isFinite(data.accZ) ||
                    Number.isFinite(data.gyroX) ||
                    Number.isFinite(data.gyroY) ||
                    Number.isFinite(data.gyroZ)
                )
            };
        }

        function findParsedFieldByName(fields, targetName) {
            if (!targetName) return null;
            const normalizedTarget = normalizeFieldName(targetName);
            return fields.find((field) => normalizeFieldName(field.name) === normalizedTarget) || null;
        }

        function normalizeFieldName(name) {
            return String(name || "").trim().toUpperCase();
        }

        function getParsedFieldNumericValue(field) {
            if (!field) return null;
            if (Number.isFinite(field.numericValue)) return field.numericValue;

            const fallback = Number(String(field.displayValue).replace(/[^0-9+\-.]/g, ""));
            return Number.isFinite(fallback) ? fallback : null;
        }

        function formatTelemetryNumber(value) {
            if (!Number.isFinite(value)) return "--";
            return Number.isInteger(value) ? String(value) : formatNumber(value);
        }

        function formatPercent(value) {
            return Number.isFinite(value) ? `${formatTelemetryNumber(value)}%` : "--";
        }

        function getVoiceBytes(value, bytes) {
            const numericValue = Number.isFinite(value) ? value : 0;
            return {
                b0: Array.isArray(bytes) && Number.isFinite(bytes[0]) ? bytes[0] : (numericValue & 0xFF),
                b1: Array.isArray(bytes) && Number.isFinite(bytes[1]) ? bytes[1] : ((numericValue >> 8) & 0xFF)
            };
        }

        function formatVoiceByte(byte) {
            if (!Number.isFinite(byte)) return "--";
            return `0x${byte.toString(16).toUpperCase().padStart(2, "0")} / ${byte}`;
        }

        function renderTelemetryDashboard() {
            if (!dom.telemetryLinkBadge) return;

            const data = resolveTelemetryDashboardData();
            if (!data) {
                dom.telemetryLinkBadge.className = "telemetry-link-badge idle";
                dom.telemetryLinkBadge.textContent = "LINK --";
                dom.telemetrySeq.textContent = "--";
                dom.telemetryMode.textContent = "--";
                dom.telemetryDistSet.textContent = "--";
                dom.telemetryFom.textContent = "--";
                dom.telemetryElevationFom.textContent = "--";
                dom.telemetryFinalRxRate.textContent = "--";
                dom.telemetryRangingRate.textContent = "--";
                dom.telemetryLinkQuality.textContent = "--";
                dom.telemetryVoiceB0.textContent = "--";
                dom.telemetryVoiceB1.textContent = "--";
                dom.telemetryFlagsText.textContent = "--";
                dom.telemetryPairId.textContent = "--";
                dom.telemetryPairStatus.textContent = "--";
                dom.telemetryKeyBitmap.textContent = "KEY --";
                dom.telemetryProtoVer.textContent = "PROTO --";
                dom.telemetryDistance.textContent = "--";
                dom.telemetryDistanceMeta.textContent = "等待完整数据帧";
                dom.telemetryAngle.textContent = "--";
                dom.telemetryElevation.textContent = "--";
                dom.telemetryJoyX.textContent = "--";
                dom.telemetryJoyY.textContent = "--";
                dom.telemetryJoyDot.style.left = "50%";
                dom.telemetryJoyDot.style.top = "50%";
                dom.telemetryKeyChips.innerHTML = '<span class="telemetry-chip">无按键</span>';
                dom.telemetryFlagChips.innerHTML = '<span class="telemetry-chip">等待数据</span>';
                dom.telemetryDistanceRing.style.setProperty("--progress", "0");
                setTelemetryStatus(dom.telemetryImuStatus, "等待数据", "idle");
                updateSignedAxis(dom.telemetryAccXFill, dom.telemetryAccXValue, null, 4096);
                updateSignedAxis(dom.telemetryAccYFill, dom.telemetryAccYValue, null, 4096);
                updateSignedAxis(dom.telemetryAccZFill, dom.telemetryAccZValue, null, 4096);
                updateSignedAxis(dom.telemetryGyroXFill, dom.telemetryGyroXValue, null, 2048);
                updateSignedAxis(dom.telemetryGyroYFill, dom.telemetryGyroYValue, null, 2048);
                updateSignedAxis(dom.telemetryGyroZFill, dom.telemetryGyroZValue, null, 2048);
                return;
            }

            const distanceValue = data.hasDist ? data.distanceCm : null;
            const angleValue = data.hasAngle ? data.angleDeg : null;
            const voiceValue = Number.isFinite(data.voiceCmd) ? data.voiceCmd : 0;
            const imuAccX = data.hasImu ? data.accX : null;
            const imuAccY = data.hasImu ? data.accY : null;
            const imuAccZ = data.hasImu ? data.accZ : null;
            const imuGyroX = data.hasImu ? data.gyroX : null;
            const imuGyroY = data.hasImu ? data.gyroY : null;
            const imuGyroZ = data.hasImu ? data.gyroZ : null;

            if (data.hasImu) {
                setTelemetryStatus(dom.telemetryImuStatus, "实时更新", "ok");
            } else {
                setTelemetryStatus(dom.telemetryImuStatus, "未标记有效", "warn");
            }

            const hasLink = Number.isFinite(data.linkState);
            const linkLabel = hasLink ? describeLink(data.linkState) : "LINK --";
            const badgeClass = !hasLink ? "idle" : data.linkState === mk8000UartSpec.linkOk ? "ok" : data.linkState === mk8000UartSpec.linkLost ? "lost" : "idle";
            dom.telemetryLinkBadge.className = `telemetry-link-badge ${badgeClass}`;
            dom.telemetryLinkBadge.textContent = linkLabel;
            dom.telemetrySeq.textContent = formatTelemetryNumber(data.seq);
            dom.telemetryMode.textContent = data.modeLabel || "--";
            dom.telemetryDistSet.textContent = Number.isFinite(data.distSet) ? `${formatTelemetryNumber(data.distSet)} m` : "--";
            dom.telemetryFom.textContent = formatTelemetryNumber(data.fom);
            dom.telemetryElevationFom.textContent = formatTelemetryNumber(data.elevationFom);
            dom.telemetryFinalRxRate.textContent = formatPercent(data.finalRxRate);
            dom.telemetryRangingRate.textContent = formatPercent(data.rangingRate);
            dom.telemetryLinkQuality.textContent = formatPercent(data.linkQuality);
            const voiceBytes = getVoiceBytes(voiceValue, data.voiceBytes);
            dom.telemetryVoiceB0.textContent = formatVoiceByte(voiceBytes.b0);
            dom.telemetryVoiceB1.textContent = formatVoiceByte(voiceBytes.b1);
            dom.telemetryFlagsText.textContent = Number.isFinite(data.flags) ? `0x${data.flags.toString(16).toUpperCase().padStart(2, "0")}` : "--";
            dom.telemetryPairId.textContent = Number.isFinite(data.pairId) ? `0x${data.pairId.toString(16).toUpperCase().padStart(2, "0")}` : "--";
            dom.telemetryPairStatus.textContent = data.pairStatusLabel || "--";
            dom.telemetryKeyBitmap.textContent = Number.isFinite(data.keyBitmap) ? `KEY 0x${data.keyBitmap.toString(16).toUpperCase().padStart(4, "0")}` : "KEY --";
            dom.telemetryProtoVer.textContent = Number.isFinite(data.protoVer) ? `PROTO ${formatTelemetryNumber(data.protoVer)}` : "PROTO --";

            const distanceScale = Number.isFinite(distanceValue)
                ? Math.max(Number.isFinite(data.distSet) ? data.distSet * 100 : 0, 100, distanceValue)
                : 0;
            const progress = distanceScale ? Math.max(0.04, Math.min(1, distanceValue / distanceScale)) : 0;
            dom.telemetryDistanceRing.style.setProperty("--progress", progress.toFixed(3));
            dom.telemetryDistance.textContent = Number.isFinite(distanceValue) ? `${formatTelemetryNumber(distanceValue)} cm` : "--";
            dom.telemetryDistanceMeta.textContent = Number.isFinite(distanceValue) || Number.isFinite(data.distSet) || Number.isFinite(data.fom) || Number.isFinite(data.elevationFom)
                ? `set ${formatTelemetryNumber(data.distSet)} m / AZ ${formatTelemetryNumber(data.fom)} / EL ${formatTelemetryNumber(data.elevationFom)}`
                : "等待完整数据帧";
            dom.telemetryAngle.textContent = Number.isFinite(angleValue) ? `${formatTelemetryNumber(angleValue)}°` : "--";
            dom.telemetryElevation.textContent = Number.isFinite(data.elevationDeg) ? `${formatTelemetryNumber(data.elevationDeg)}°` : "--";

            dom.telemetryJoyX.textContent = formatTelemetryNumber(data.joyX);
            dom.telemetryJoyY.textContent = formatTelemetryNumber(data.joyY);
            dom.telemetryJoyDot.style.left = `${50 + clamp((Number.isFinite(data.joyX) ? data.joyX : 0) / 127, -1, 1) * 32}%`;
            dom.telemetryJoyDot.style.top = `${50 - clamp((Number.isFinite(data.joyY) ? data.joyY : 0) / 127, -1, 1) * 32}%`;

            dom.telemetryKeyChips.innerHTML = (data.keyNames.length ? data.keyNames : ["无按键"])
                .map((name) => `<span class="telemetry-chip">${escapeHtml(name)}</span>`)
                .join("");
            dom.telemetryFlagChips.innerHTML = data.flagNames.length
                ? data.flagNames.map((name) => `<span class="telemetry-chip">${escapeHtml(name)}</span>`).join("")
                : '<span class="telemetry-chip">无有效标记</span>';

            updateSignedAxis(dom.telemetryAccXFill, dom.telemetryAccXValue, imuAccX, 4096);
            updateSignedAxis(dom.telemetryAccYFill, dom.telemetryAccYValue, imuAccY, 4096);
            updateSignedAxis(dom.telemetryAccZFill, dom.telemetryAccZValue, imuAccZ, 4096);
            updateSignedAxis(dom.telemetryGyroXFill, dom.telemetryGyroXValue, imuGyroX, 2048);
            updateSignedAxis(dom.telemetryGyroYFill, dom.telemetryGyroYValue, imuGyroY, 2048);
            updateSignedAxis(dom.telemetryGyroZFill, dom.telemetryGyroZValue, imuGyroZ, 2048);
        }

        function setTelemetryStatus(node, text, tone = "idle") {
            if (!node) return;
            node.className = `telemetry-panel-state ${tone}`;
            node.textContent = text;
        }

        function updateSignedAxis(fillNode, valueNode, value, range) {
            if (!fillNode || !valueNode) return;
            if (!Number.isFinite(value)) {
                fillNode.style.left = "50%";
                fillNode.style.width = "0";
                valueNode.textContent = "--";
                return;
            }
            const ratio = clamp(value / range, -1, 1);
            const width = Math.abs(ratio) * 50;
            fillNode.style.left = ratio >= 0 ? "50%" : `${50 - width}%`;
            fillNode.style.width = `${width}%`;
            valueNode.textContent = String(value);
        }

        function describeMode(mode) {
            const map = ["CONTROL", "FOLLOW", "ASSIST", "PARK"];
            return map[mode] || `MODE ${mode}`;
        }

        function describeLink(linkState) {
            if (linkState === mk8000UartSpec.linkOk) return "LINK OK";
            if (linkState === mk8000UartSpec.linkLost) return "LINK LOST";
            return `LINK 0x${linkState.toString(16).toUpperCase().padStart(2, "0")}`;
        }

        function describeKeys(keyBitmap) {
            const names = [];
            if (keyBitmap & 0x0001) names.push("KEY1");
            if (keyBitmap & 0x0002) names.push("KEY2");
            if (keyBitmap & 0x0004) names.push("KEY3");
            return names;
        }

        function describeFlags(flags) {
            const names = [];
            if (flags & mk8000UartSpec.flagDistValid) names.push("DIST");
            if (flags & mk8000UartSpec.flagAngleValid) names.push("ANGLE");
            if (flags & mk8000UartSpec.flagVoiceValid) names.push("VOICE");
            if (flags & mk8000UartSpec.flagImuValid) names.push("IMU");
            if (flags & mk8000UartSpec.flagPairing) names.push("PAIRING");
            return names;
        }

        function describePairStatus(status) {
            if (status === mk8000UartSpec.pairStatusUnpaired) return "未配对";
            if (status === mk8000UartSpec.pairStatusPaired) return "已配对";
            if (status === mk8000UartSpec.pairStatusPairing) return "配对中";
            return `状态 0x${status.toString(16).toUpperCase().padStart(2, "0")}`;
        }

        function writeU16LE(frame, offset, value) {
            frame[offset] = value & 0xFF;
            frame[offset + 1] = (value >> 8) & 0xFF;
        }

        function writeS16LE(frame, offset, value) {
            const buffer = new ArrayBuffer(2);
            const view = new DataView(buffer);
            view.setInt16(0, value, true);
            writeBytesIntoFrame(frame, offset, Array.from(new Uint8Array(buffer)));
        }

        function writeS8(frame, offset, value) {
            const buffer = new ArrayBuffer(1);
            const view = new DataView(buffer);
            view.setInt8(0, value);
            writeBytesIntoFrame(frame, offset, Array.from(new Uint8Array(buffer)));
        }

        function readS16LE(frame, offset) {
            const array = Uint8Array.from(frame.slice(offset, offset + 2));
            return new DataView(array.buffer).getInt16(0, true);
        }

        function copyFrameBytes(source, sourceOffset, target, targetOffset, length) {
            for (let index = 0; index < length; index += 1) {
                target[targetOffset + index] = source[sourceOffset + index];
            }
        }

        function clamp(value, min, max) {
            return Math.min(max, Math.max(min, value));
        }

        initialize();
    


