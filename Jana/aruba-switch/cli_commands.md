# 📘 Command: `show boot-history`

Displays the boot history of the management module on the Aruba CX switch.

---

## 🔍 Output Overview

The output lists the chronological history of system boots, including:

- Boot index
- Unique boot ID
- Timestamps
- Reset reasons
- Software versions
- Switch boot counts
- Uptime (for the current boot)

---

## 🧠 Example Output

| Index | Boot ID                              | Timestamp           | Event                        | Version         | Boot Count | Status                                |
|-------|---------------------------------------|---------------------|------------------------------|------------------|------------|----------------------------------------|
| 3     | `3a133947ec44493da909c151df78cc81`    | Current             | Currently running system     | —                | —          | ⏱️ Up for 35 days 4 hrs 40 mins 52 secs |
| 2     | `a32ae345fc3944dd98d2f6fd2a20003b`    | 14 Feb 25 18:28:45  | Power on reset (0x1)         | FL.10.12.1021    | 0          | —                                      |
| 1     | `e47fbf6d123749b780e805c98ea5a32d`    | 14 Feb 25 17:46:36  | Power on reset (0x1)         | FL.10.12.1021    | 0          | —                                      |
| 0     | `9a74a5cb9aa04be99ef52c38308a4dda`    | 14 Feb 25 17:23:36  | Power on reset (0x1)         | FL.10.12.1021    | 0          | —                                      |

---

## 📌 Notes

- **Boot ID**: A unique identifier for each boot instance.
- **Power on reset (0x1)**: Indicates a full reset due to power cycle.
- **Switch boot count**: Number of times the system has booted since the respective reset.
- **Current Boot**: The system currently in operation, with displayed uptime.


# 📘 Command: `show clock`

Displays the current system time and configured timezone on the Aruba CX switch.

---

## 🔍 Output Overview

The output provides the current date and time along with the system’s configured timezone.

---

## 🧠 Example Output

| Parameter         | Value                       |
|------------------|-----------------------------|
| Current Date/Time| Fri Mar 21 23:02:14 UTC 2025 |
| Timezone         | UTC                         |

---

## 📌 Notes

- The time is shown in the format: `Day Month Date HH:MM:SS Timezone Year`.
- The system timezone is explicitly configured and reported.
- Useful for:
  - Time synchronization
  - Log correlation
  - Time-based configuration accuracy


  # 📘 Command: `show environment`

Displays detailed environmental data about the switch, including fan status, temperature sensors, power supply, LED states, and redundancy configuration.

---

## 🔍 Output Overview

The output is divided into several sections:

- **Fan Information**: Shows operational status, speed, and direction of installed fans.
- **LED Status**: Provides state and health of system indicators.
- **Power Redundancy**: Displays configured and operational power redundancy status.
- **Power Supply**: Lists details of installed power supplies.
- **Temperature Sensors**: Reports current temperatures and status of various modules and sensors.

---

## 🧠 Output

### 🔧 Fan Information

| Location       | Speed | Direction      | Status | RPM  |
|----------------|-------|----------------|--------|------|
| System-1/1/1   | slow  | left-to-back   | ok     | 3987 |
| System-1/1/2   | slow  | left-to-back   | ok     | 4022 |
| System-1/1/3   | N/A   | left-to-back   | ok     | N/A  |

---

### 💡 LED Status

| Location   | State | Status |
|------------|-------|--------|
| 1/locator  | off   | ok     |

---

### 🔌 Power Redundancy

| Member Number | Configured Redundancy | Operational Redundancy |
|---------------|------------------------|--------------------------|
| 1             | n/a                    | n/a                      |

---

### 🔋 Power Supply

| PSU       | Status | Type | Voltage Range | Max Wattage |
|-----------|--------|------|----------------|--------------|
| 1/1       | OK     | AC   | 100V–240V       | 950 W        |

---

### 🌡️ Temperature Sensors

| Sensor Location              | Module Type         | Current Temp | Status |
|-----------------------------|---------------------|--------------|--------|
| 1/1-PHY-01-08               | line-card-module    | 54.00 °C     | normal |
| 1/1-PHY-09-16               | line-card-module    | 53.00 °C     | normal |
| 1/1-PHY-17-24               | line-card-module    | 52.00 °C     | normal |
| 1/1-Switch-ASIC-Internal    | line-card-module    | 73.12 °C     | normal |
| 1/1-CPU                     | management-module   | 52.38 °C     | normal |
| 1/1-CPU-Zone-0              | management-module   | 49.00 °C     | normal |
| 1/1-CPU-Zone-1              | management-module   | 49.00 °C     | normal |
| 1/1-CPU-Zone-2              | management-module   | 49.00 °C     | normal |
| 1/1-CPU-Zone-3              | management-module   | 49.00 °C     | normal |
| 1/1-CPU-Zone-4              | management-module   | 49.00 °C     | normal |
| 1/1-DDR                    | management-module   | 38.00 °C     | normal |
| 1/1-DDR-Inlet              | management-module   | 29.38 °C     | normal |
| 1/1-Inlet-Air              | management-module   | 23.50 °C     | normal |
| 1/1-Switch-ASIC-Remote     | management-module   | 74.12 °C     | normal |

---

## 📌 Notes

- **Fan modules** are operational with expected speed and airflow direction.
- **Temperature sensors** show values well within operational range; ASIC temps slightly higher due to processing load.
- **Power redundancy** is not configured or not supported on this device.
- **Power supply** is active and healthy.
- LED locator is currently **off**, indicating no active physical location signal.


# 📘 Command: `show interface brief`

Displays a summarized status of all switch interfaces, including port mode, speed, operational status, and descriptions.

---

## 🔍 Output Overview

The output includes the following key interface details:

- Port number
- VLAN assignment (native VLAN)
- Interface mode (e.g., access, VSF)
- Interface type (e.g., 1GbT, VSF, or unknown)
- Administrative status (enabled/disabled)
- Operational status (up/down)
- Reason for status (if down)
- Link speed (in Mbps)
- Description (if configured)

---

## 🧠 Example Output

| Port     | VLAN | Mode   | Type   | Enabled | Status | Reason               | Speed | Description              |
|----------|------|--------|--------|---------|--------|----------------------|--------|--------------------------|
| 1/1/1    | 1    | access | 1GbT   | yes     | up     | —                    | 1000   | JANA Management Po...    |
| 1/1/2    | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/3    | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/4    | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/5    | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/6    | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/7    | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/8    | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/9    | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/10   | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/11   | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/12   | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/13   | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/14   | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/15   | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/16   | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/17   | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/18   | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/19   | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/20   | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/21   | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/22   | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/23   | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/24   | 1    | access | 1GbT   | yes     | down   | Waiting for link     | —      | —                        |
| 1/1/25   | —    | VSF    | —      | yes     | down   | No XCVR installed    | —      | —                        |
| 1/1/26   | —    | VSF    | —      | yes     | down   | No XCVR installed    | —      | —                        |
| 1/1/27   | 1    | access | —      | yes     | down   | No XCVR installed    | —      | —                        |
| 1/1/28   | 1    | access | —      | yes     | down   | No XCVR installed    | —      | —                        |
| vlan1    | —    | —      | —      | yes     | up     | —                    | —      | JANA Management In...    |

---

## 📌 Notes

- **Up ports** indicate active physical links and connections.
- Most interfaces are **administratively enabled** but in a `down` state, awaiting a connected device.
- **Ports 1/1/25–28** show "No XCVR installed", meaning no transceivers are physically present.
- **vlan1** is a virtual interface (SVI) used for in-band management.


# 📘 Command: `show interface error-statistics`

Displays the error counters for each physical interface on the Aruba CX switch. This helps in monitoring interface-level issues such as collisions, CRC errors, and frame anomalies.

---

## 🔍 Output Overview

The output provides a breakdown of error statistics for each interface, including:

- RX (Receive) and TX (Transmit) Errors
- RX Giants (oversized frames)
- RX Runts (undersized frames)
- CRC/FCS Errors (frame checksum errors)
- Collisions (typically in half-duplex networks)

---

## 🧠 Example Output

| Interface | RX Errors | TX Errors | RX Giants | RX Runts | CRC/FCS Errors | Collisions |
|-----------|-----------|-----------|-----------|----------|----------------|------------|
| 1/1/1     | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/2     | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/3     | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/4     | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/5     | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/6     | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/7     | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/8     | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/9     | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/10    | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/11    | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/12    | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/13    | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/14    | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/15    | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/16    | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/17    | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/18    | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/19    | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/20    | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/21    | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/22    | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/23    | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/24    | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/25    | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/26    | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/27    | 0         | 0         | 0         | 0        | 0              | 0          |
| 1/1/28    | 0         | 0         | 0         | 0        | 0              | 0          |

---

## 📌 Notes

- All interfaces currently report **zero errors**, indicating a clean operational state.
- This command is valuable for **proactive troubleshooting**, helping detect issues like:
  - Bad cables (CRC errors)
  - Duplex mismatches (collisions)
  - Frame size anomalies (giants/runts)
- Continuous monitoring helps ensure network stability and physical layer integrity.


# 📘 Command: `show interface physical`

Displays detailed physical interface characteristics, including link state, speed, PoE power usage, and flow control configuration.

---

## 🔍 Output Overview

This command provides per-port physical details such as:

- **Link & Admin Status**: Operational vs. configured state
- **Speed**: Actual and configured interface speeds
- **Flow Control & EEE**: Energy-efficient Ethernet and traffic pause capabilities
- **PoE Power**: Power delivered over Ethernet (Watts)
- **Port State**: Interface capabilities and conditions
- **Descriptions**: Port-level descriptions (truncated if long)

---

## 🧠 Example Output

| Port   | Type | Link | Admin | Speed | Flow Control | EEE | PoE (W) | Port State                        | Description              |
|--------|------|------|-------|-------|---------------|-----|----------|-----------------------------------|---------------------------|
| 1/1/1  | 1GbT | up   | up    | 1G    | —             | off | 0.00     | 10M/100M/1G                       | JANA Management Po...     |
| 1/1/2  | 1GbT | down | up    | —     | —             | off | 0.00     | Waiting for link, 10M/100M/1G     | —                         |
| 1/1/3  | 1GbT | down | up    | —     | —             | off | 0.00     | Waiting for link, 10M/100M/1G     | —                         |
| 1/1/4  | 1GbT | down | up    | —     | —             | off | 0.00     | Waiting for link, 10M/100M/1G     | —                         |
| ...    | ...  | ...  | ...   | ...   | ...           | ... | ...      | ...                               | ...                       |
| 1/1/25 | —    | down | up    | —     | —             | off | —        | No XCVR installed, 1G/10G/25G/50G | —                         |
| 1/1/26 | —    | down | up    | —     | —             | off | —        | No XCVR installed, 1G/10G/25G/50G | —                         |
| 1/1/27 | —    | down | up    | —     | —             | off | —        | No XCVR installed, 1G/10G/25G/50G | —                         |
| 1/1/28 | —    | down | up    | —     | —             | off | —        | No XCVR installed, 1G/10G/25G/50G | —                         |

> **Note**: Only the first few entries are shown for brevity.

---

## 📌 Notes

- **Link Status** shows real-time connection state; `up` indicates active physical links.
- **PoE Power** (in watts) is `0.00` for all ports, indicating no active power draw.
- **EEE** (Energy Efficient Ethernet) is disabled (`off`) across all ports.
- **Flow Control** status is not configured (`--`) in this setup.
- Ports without transceivers installed show the message: `No XCVR installed`.


# 📘 Command: `show interface statistics`

Displays detailed traffic statistics for each interface, including byte/packet counts, drops, and multicast/broadcast traffic.

---

## 🔍 Output Overview

This command provides a breakdown of interface-level traffic, including:

- **RX/TX Bytes & Packets**: Total amount of data received/sent
- **RX/TX Drops**: Number of dropped packets on input/output
- **Broadcast & Multicast**: Layer 2 traffic types received/sent
- **Pause Frames**: Flow control mechanisms used in congestion

---

## 🧠 Example Output

| Interface | RX Bytes   | RX Packets | RX Drops | TX Bytes   | TX Packets | TX Drops | RX Broadcast | RX Multicast | TX Broadcast | TX Multicast | RX Pause | TX Pause |
|-----------|------------|------------|----------|------------|------------|----------|---------------|---------------|---------------|---------------|-----------|-----------|
| 1/1/1     | 313,745,189| 764,874    | 0        | 420,592,383| 2,200,439  | 0        | 20,835        | 180,050       | 32,403        | 1,496,954     | 0         | 0         |
| 1/1/2     | 0          | 0          | 0        | 0          | 0          | 0        | 0             | 0             | 0             | 0             | 0         | 0         |
| 1/1/3     | 0          | 0          | 0        | 0          | 0          | 0        | 0             | 0             | 0             | 0             | 0         | 0         |
| 1/1/4     | 0          | 0          | 0        | 0          | 0          | 0        | 0             | 0             | 0             | 0             | 0         | 0         |
| ...       | ...        | ...        | ...      | ...        | ...        | ...      | ...           | ...           | ...           | ...           | ...       | ...       |
| 1/1/28    | 0          | 0          | 0        | 0          | 0          | 0        | 0             | 0             | 0             | 0             | 0         | 0         |

> **Note**: All interfaces except `1/1/1` show zero traffic, indicating no link activity.

---

## 📌 Notes

- **RX/TX Bytes**: Useful for bandwidth monitoring and performance tracking.
- **Drops**: Persistent RX or TX drops may indicate congestion or misconfigurations.
- **Broadcast/Multicast**: Helps analyze network flooding or control traffic patterns.
- **Pause Frames**: If non-zero, could indicate flow-control activation due to congestion.
- Consistent zeros across interfaces (except active ones) is normal when no devices are connected.


# 📘 Command: `show interface utilization`

Displays real-time interface bandwidth utilization metrics, including RX/TX Mbps, packets per second (KPkts/s), and utilization percentage.

---

## 🔍 Output Overview

This command provides utilization statistics per interface, updated over a defined interval:

- **RX/TX Mbps**: Data throughput in megabits per second
- **RX/TX KPkts/s**: Packets received/transmitted per second (in thousands)
- **Util%**: Interface utilization percentage
- **Interval**: Sampling interval for stats collection (in seconds)
- **Description**: Interface description (if configured)

---

## 🧠 Example Output

| Interface | Interval (s) | RX Mbps | RX KPkts/s | RX Util% | TX Mbps | TX KPkts/s | TX Util% | Total Mbps | Total KPkts/s | Total Util% | Description              |
|-----------|---------------|---------|-------------|----------|---------|-------------|----------|-------------|----------------|-------------|---------------------------|
| 1/1/1     | 300           | 0.00    | 0.00        | 0.00     | 0.00    | 0.00        | 0.00     | 0.00        | 0.00           | 0.00        | JANA Management Po...     |
| 1/1/2     | 300           | 0.00    | 0.00        | 0.00     | 0.00    | 0.00        | 0.00     | 0.00        | 0.00           | 0.00        | —                         |
| 1/1/3     | 300           | 0.00    | 0.00        | 0.00     | 0.00    | 0.00        | 0.00     | 0.00        | 0.00           | 0.00        | —                         |
| ...       | ...           | ...     | ...         | ...      | ...     | ...         | ...      | ...         | ...            | ...         | ...                       |
| 1/1/28    | 300           | 0.00    | 0.00        | 0.00     | 0.00    | 0.00        | 0.00     | 0.00        | 0.00           | 0.00        | —                         |

> **Note**: All interfaces show `0.00` for all values, indicating no active traffic at the time of polling.

---

## 📌 Notes

- **Interval** is typically set to `300` seconds by default.
- This command is helpful for:
  - **Identifying high-utilization ports**
  - **Monitoring real-time usage trends**
  - **Capacity planning and troubleshooting congestion**
- Persistent `0.00` values typically mean no link or no traffic on the interface.


# 📘 Command: `show interface`

Displays comprehensive status and performance details for each physical interface on the Aruba CX switch.

---

## 🔍 Output Overview

For each interface, the command provides:

- **Link/Administrative State**
- **MAC Address, Duplex Mode, Speed, MTU**
- **Auto-negotiation, Flow Control, and Energy Efficiency settings**
- **VLAN Mode and VLAN ID**
- **Interface description and rate collection interval**
- **Real-time bandwidth and packet rate statistics**
- **Cumulative packet/byte counters**
- **Error statistics (CRC, collisions, giants, runts, etc.)**

---

## 🧠 Example Output

### 🔌 Interface 1/1/1

| Field                  | Value                                 |
|------------------------|---------------------------------------|
| Link/Admin State       | up / up                               |
| Uptime                 | 25 days (since Feb 24 03:14:49 UTC)   |
| Link Transitions       | 5                                     |
| Description            | JANA Management Port VLAN1            |
| MAC Address            | 88:3a:30:a8:5f:e7                      |
| Type                   | 1GbT, Full-duplex                     |
| Speed                  | 1000 Mb/s                              |
| Auto-Negotiation       | on                                    |
| Energy-Efficient Eth.  | disabled                              |
| Flow Control           | off                                   |
| VLAN Mode              | access (VLAN 1)                       |

#### 📊 Real-Time Rate (1/1/1)

| Metric            | RX      | TX      | Total   |
|-------------------|---------|---------|---------|
| Mbits/sec         | 0.00    | 0.00    | 0.00    |
| KPkts/sec         | 0.00    | 0.00    | 0.00    |
| Unicast           | 0.00    | 0.00    | 0.00    |
| Multicast         | 0.00    | 0.00    | 0.00    |
| Broadcast         | 0.00    | 0.00    | 0.00    |
| Utilization (%)   | 0.00    | 0.00    | 0.00    |

#### 📈 Cumulative Statistics (1/1/1)

| Counter            | RX         | TX         | Total      |
|--------------------|------------|------------|------------|
| Packets            | 765,763    | 2,202,253  | 2,968,016  |
| Unicast            | 564,711    | 671,870    | 1,236,581  |
| Multicast          | 180,204    | 1,497,959  | 1,678,163  |
| Broadcast          | 20,848     | 32,424     | 53,272     |
| Bytes              | 314,085,222| 420,903,517| 734,988,739|
| Dropped            | 0          | 0          | 0          |
| Pause Frames       | 0          | 0          | 0          |
| Errors             | 0          | 0          | 0          |
| CRC/FCS            | 0          | n/a        | 0          |
| Collisions         | n/a        | 0          | 0          |
| Runts              | 0          | n/a        | 0          |
| Giants             | 0          | n/a        | 0          |

---

### 🔌 Interface 1/1/2 – 1/1/5

| Field                  | Value                                |
|------------------------|--------------------------------------|
| Link/Admin State       | down / up                            |
| Link Down Duration     | ~1 month                             |
| Link Transitions       | 0                                    |
| Description            | —                                    |
| MAC Address            | (unique per port)                    |
| Type                   | 1GbT, Full-duplex                    |
| Speed                  | 0 Mb/s                               |
| Auto-Negotiation       | on                                   |
| Flow Control / EEE     | off / disabled                       |
| VLAN Mode              | access (VLAN 1)                      |

All ports show `0` for traffic, errors, and drops, indicating no devices are connected or transmitting data.

---

## 📌 Notes

- **Active Ports**: Only interface `1/1/1` is currently active and carrying traffic.
- **Down Ports**: Interfaces `1/1/2–1/1/5` are up administratively but waiting for physical link.
- **MAC addresses** are unique for each port and used for Layer 2 communication.
- **Error counters** (CRC, collisions, etc.) are all zero, indicating healthy physical layer status.

> This command is valuable for **real-time interface diagnostics**, **bandwidth utilization**, and **traffic type visibility**.


# 📘 Command: `show ip dns`

Displays the DNS configuration for the switch, including VRF settings, DNS mode, and configured name servers.

---

## 🔍 Output Overview

This command provides information about:

- **VRF context** used for DNS resolution
- **DNS mode** (e.g., static or dynamic)
- **Configured name server(s)**
- **Host configuration status**
- **Static host-to-IP mappings** (if any are configured)

---

## 🧠 Example Output

| Field               | Value       |
|---------------------|-------------|
| VRF Name            | default     |
| Mode                | static      |
| Name Server(s)      | 8.8.8.8     |
| Host Configuration  | Active      |
| Host Entries        | None        |

---

## 📌 Notes

- The switch is using **Google's public DNS server (8.8.8.8)** for name resolution.
- **Static mode** indicates DNS servers were manually configured.
- No custom **host-to-IP mappings** are present at the time of this command output.
- VRF `default` is being used, which means DNS lookups occur in the main routing table.











Useful commands:
- show boot-history
- show clock
- show environment
- show interface brief
- show interface error-statistics
- show interface lag
- show interface physical
- show interface statistics
- show interface utilization
- show interface (ALOT OF TOKENS)
- show ip dns
- show lldp local
- show lldp neighbor
- show mac-address-table
- show resources
- show system resource-utilization (ALOT OF TOKENS)
- show uptime
- show version
- show vlan
- show vrf
- show vsf detail
- show vsf link detail
- show vsf link error-detail
- show vsf topology


Maybe useful commands:
- show capacities
- show capacities-status
- show class ip
- show class ipv6
- show copp-policy statistics
- show dhcp-server
- show dhcpv4-snooping binding
- show dhcpv4-snooping
- show dhcpv6-server
- show dhcpv6-snooping binding
- show dhcpv6-snooping
- show interface qos
- show interface queues
- show ip helper-address
- show ipv6 neighbors all-vrfs
- show ipv6 neighbors
- show lacp aggregates
- show lacp interfaces
- show ntp associations
- show ntp servers
- show ntp status
- show power-over-ethernet
- show spanning-tree detail (ALOT OF TOKENS)
- show spanning-tree mst detail (ALOT OF TOKENS)
- show tacacs-server