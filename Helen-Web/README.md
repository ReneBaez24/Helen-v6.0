# Helen v5.0.2 - Mexican Sign Language Recognition System

Helen is an intelligent home assistant for the deaf community that recognizes Mexican Sign Language (LSM) gestures to control smart home devices. This version represents a complete architectural migration from Electron to a web-based application optimized for Raspberry Pi deployment.

## Project Overview

Helen v5.0.2 uses a PyTorch LSTM bidirectional neural network to recognize 10 LSM gestures in real-time, enabling users to control home automation features through sign language instead of voice commands.

**Recognized Gestures:** agregar, alarma, camara, clima, colores, configuracion, dispositivos, editar, home, wifi
**New in v6.0:** `calendario` (opens the Calendar screen). The frontend is ready for it; the model must be retrained to recognize it — see [Calendar Screen](#calendar-screen-v60).

**Key Metrics:**
- Recognition Accuracy: >90%
- Response Time: <3 seconds
- Supported Hardware: Raspberry Pi 5 (8GB), laptops, desktops

## System Architecture
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER (Raspberry Pi / Browser)                    │
│                                                                               │
│  ┌──────────┐    ┌───────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │   User   │───▶│  Webcam   │───▶│ MediaPipe.js │───▶│   React App    │  │
│  │ (Gestur) │    │  Camera   │    │   Landmark   │    │   Port 3000    │  │
│  │          │    │           │    │  Extraction  │    │  (Vite/React)  │  │
│  └──────────┘    └───────────┘    │  126 features│    └────────┬───────┘  │
│                                    └──────────────┘             │           │
│                                                                  │           │
└──────────────────────────────────────────────────────────────────┼───────────┘
                                                                   │
                                    WebSocket Connection (Port 5001)
                                    Sends: 126 features per frame
                                                                   │
                                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AWS EC2 SERVER LAYER                                │
│                                                                               │
│  ┌─────────────────┐                 ┌──────────────────────────────────┐  │
│  │     Nginx       │                 │    WebSocket Server              │  │
│  │   Port 3000     │◀────────────────│    Flask-SocketIO                │  │
│  │ Serves React    │  Static Files   │       Port 5001                  │  │
│  │   Build Files   │                 │                                  │  │
│  └─────────────────┘                 └────────────┬─────────────────────┘  │
│                                                    │                         │
│                                                    ▼                         │
│                                      ┌──────────────────────┐               │
│                                      │   Frame Buffer       │               │
│                                      │  Per Session Store   │               │
│                                      │  40 frames x 126 feat│               │
│                                      └──────────┬───────────┘               │
│                                                 │                            │
│                                      When buffer full (40 frames)           │
│                                                 │                            │
│                                                 ▼                            │
│                                      ┌──────────────────────┐               │
│                                      │    LSTM Model        │               │
│  ┌────────────────────┐              │  Bidirectional LSTM  │               │
│  │  Model Files       │─────loads────│  699,722 parameters  │               │
│  │                    │              │  Input: 40 x 126     │               │
│  │ model_final.pth    │              │  Output: 10 classes  │               │
│  │ gestures_map.json  │              └──────────┬───────────┘               │
│  │ norm_stats.pth     │                         │                           │
│  └────────────────────┘                         │                           │
│                                                  ▼                           │
│                                      ┌──────────────────────┐               │
│                                      │   Prediction Result  │               │
│                                      │  gesture + confidence│               │
│                                      └──────────┬───────────┘               │
│                                                 │                            │
└─────────────────────────────────────────────────┼───────────────────────────┘
                                                  │

                                                  ▼
                                      ┌──────────────────────┐
                                      │   React Frontend     │
                                    -------------------------------------------------------------+
                                      │  Executes Action:    │
                                    -------------------------------------------------------------+
                                      │  - Navigate screen   │
                                      │  - Show modal        │
                                      │  - Update UI         │
                                      └──────────────────────┘

External APIs (Optional):
  - OpenWeather API (weather data)
                                    -------------------------------------------------------------+
  - TimezoneDB API (time/date)
```
                                    -------------------------------------------------------------+

                                    -------------------------------------------------------------+
### Communication Flow
                                    -------------------------------------------------------------+

1. **User performs LSM gesture** → Camera captures video stream
2. **MediaPipe.js processes locally** → Extracts 126 features per frame (21 landmarks × 2 hands × 3 coordinates)
3. **React sends via WebSocket** → Landmarks transmitted to EC2 server (Port 5001)
4. **WebSocket Server buffers** → Accumulates 40 frames in circular buffer per session
5. **Buffer reaches 40 frames** → Sequence passed to LSTM model
6. **LSTM predicts gesture** → Returns gesture name and confidence score
7. **Prediction sent back** → WebSocket transmits result to React client
8. **React executes action** → Navigate to screen, display modal, or update interface

### Architecture Layers

**Layer 1: Frontend (React Web App)**
- Technology: React with Vite bundler
- Location: Hosted on AWS EC2 (Port 3000, served by Nginx)
- Responsibilities: UI, MediaPipe.js landmark extraction, WebSocket client, navigation

**Layer 2: Backend (WebSocket Server)**
- Technology: Flask-SocketIO with Python
- Location: AWS EC2 (Port 5001)
- Responsibilities: Real-time connections, frame buffering, model inference, session management

**Layer 3: ML Service (LSTM Model)**
- Technology: PyTorch
- Model: Bidirectional LSTM with 699,722 parameters
                                    -------------------------------------------------------------+
- Input: 40 frames × 126 features
- Output: Gesture prediction with confidence score
```
Helen_v5.0.2/
├── backend/
│   ├── ml-service/              # Machine learning pipeline
│   │   ├── model.py             # GestureNet LSTM architecture
│   │   ├── train_solid.py       # Training script with validation
│   │   ├── data_prep.py         # Video processing and landmark extraction
│   │   ├── inference.py         # Standalone prediction service
│   │   ├── data/
│   │   │   ├── X_data.npy       # Training sequences (N × 40 × 126)
│   │   │   ├── Y_labels.npy     # Gesture labels
│   │   │   └── gestures_map.json # Gesture name to ID mapping
│   │   └── trained_models/
│   │       ├── model_final.pth  # Trained LSTM weights (4.2MB)
│   │       └── normalization_stats.pth # Mean/std for normalization
│   │
│   ├── websocket-server/        # Real-time WebSocket server
│   │   ├── server.py            # Main Flask-SocketIO server
│   │   ├── requirements.txt     # Python dependencies
│   │   └── .env                 # Configuration (PORT, MODEL_PATH, DEVICE)
│   │
│   ├── test_system.py           # System verification tests
│   └── helen_util.py            # Utility scripts for setup
│
├── frontend/
│   └── web-app/                 # React web application
│       ├── src/
│       │   ├── components/      # Reusable UI components
│       │   ├── screens/         # Full-page views (Home, Weather, Alarms, etc.)
│       │   ├── services/
│       │   │   ├── websocketService.js  # WebSocket communication
│       │   │   ├── mediapipeService.js  # Hand landmark detection
│       │   │   └── apiService.js        # External API calls
│       │   ├── contexts/        # React contexts (Theme, Camera)
│       │   ├── assets/          # Images, icons, fonts
│       │   └── App.jsx          # Main application component
│       ├── vite.config.js       # Build configuration
│       ├── package.json         # Dependencies and scripts
│       └── .env                 # Environment variables
│
├── deployment/                  # Deployment automation
│   ├── redeploy-all.sh         # Full system deployment
│   ├── redeploy-model.sh       # Update ML model only
│   ├── redeploy-webapp.sh      # Update frontend only
│   ├── nginx/                  # Nginx configurations
│   ├── systemd/                # Systemd service files
│   └── raspberry/              # Raspberry Pi kiosk setup
│
└── docs/                       # Documentation and reports
```

## Setup and Installation

### Prerequisites
- Python 3.8+
- Node.js 16+
- AWS EC2 instance (Ubuntu 22.04)
- Raspberry Pi 5 (8GB) for deployment

### Backend Setup

1. Navigate to ml-service and install dependencies:
```bash
cd backend/ml-service
pip install -r requirements.txt
```

2. Navigate to websocket-server and install dependencies:
```bash
cd backend/websocket-server
pip install -r requirements.txt
```

3. Configure environment variables in `websocket-server/.env`:
```env
PORT=5001
MODEL_PATH=../ml-service/trained_models/model_final.pth
GESTURES_MAP_PATH=../ml-service/data/gestures_map.json
NORMALIZATION_STATS_PATH=../ml-service/trained_models/normalization_stats.pth
DEVICE=cpu
```

4. Start WebSocket server:
```bash
python server.py
```

### Frontend Setup

1. Navigate to web-app:
```bash
cd frontend/web-app
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables in `.env`:
```env
VITE_WEBSOCKET_URL=ws://localhost:5001
VITE_API_URL=http://localhost:5000
```

4. Run development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
```

## Deployment

### AWS EC2 Deployment

Use the automated deployment scripts in `/deployment`:

**Full deployment (WebSocket + React):**
```bash
cd deployment
./redeploy-all.sh
```

**Update model only:**
```bash
./redeploy-model.sh
```

**Update frontend only:**
```bash
./redeploy-webapp.sh
```

### Raspberry Pi Setup

Configure Raspberry Pi as thin client in kiosk mode:
```bash
cd deployment/raspberry
./kiosk-setup.sh
```

This will:
- Install Chromium browser
- Configure autostart to open Helen web app
- Disable screensaver
- Set up auto-login

The Pi will automatically open `http://13.58.208.156:3000` on boot.

## Calendar Screen (v6.0)

Route: `/calendar` · Screen: `src/screens/Calendar.jsx`

**What it does**
- Month view (Monday-first) with Mexican holidays highlighted:
  - **Feriado oficial** (solid red): mandatory rest days from LFT Art. 74 — Jan 1, 1st Monday of Feb, 3rd Monday of Mar, May 1, Sep 16, 3rd Monday of Nov, Dec 25, and Oct 1 every 6 years (2030, 2036…). Election day (fraction IX) is not computed.
  - **Día conmemorativo** (dashed yellow): Día de Reyes, Semana Santa, Día de las Madres, Día de Muertos, 12 de diciembre, Día Nacional de la LSM (Jun 10), Día Internacional de las Lenguas de Señas (Sep 23), etc.
- Reminders CRUD (create / read / update / delete), stored in `localStorage` under `reminders`, same approach as alarms and devices.
  - Can only be created or moved to **today or a future day**. Past reminders are read-only but can be deleted.
  - Touch-first form: date stepper, optional time, category chips, optional title (no keyboard required). Max 10 per day.

**How to open it**
| Input | Action |
|---|---|
| LSM sign `calendario` | Opens the Calendar from any screen |
| Tap the date card on Home | Opens the Calendar |
| LSM sign `agregar` (on Calendar) | New reminder for the selected day |
| LSM sign `editar` (on Calendar) | Toggle edit mode (edit / delete reminders) |

**Files**
```
src/screens/Calendar.jsx / Calendar.css         # screen
src/components/calendar/ReminderModal.jsx/.css  # add / edit form
src/components/calendar/calendarFormat.js       # Spanish date formatting
src/services/reminderService.js                 # CRUD + validation (localStorage)
src/utils/mexicanHolidays.js                    # holiday calculation per year
```
Gesture wiring: `config/constants.js` (`ROUTES.CALENDAR`, `GESTURE_ACTIONS.calendario`, `SIGN_GESTURES.CALENDARIO`) and `components/input/TouchHandler.jsx` (web gesture router).

### Training the `calendario` sign

The deployed model (`model_final.pth`) has 10 output classes and does **not** know `calendario` yet. Until it is retrained, the Calendar is reachable by touch only.

> ⚠️ Do **not** add `calendario` to `gestures_map.json` by hand: the server builds the network with `len(gestures_map)` outputs, so a map with 11 entries and a 10-class model will fail to load. The map and the model must always be regenerated together.

1. Record the sign (≥ 20 clips, 3 s each; vary people, lighting and distance). Use the sign for *calendario* as used by your LSM consultants / deaf community members:
   ```bash
   cd backend/ml-service
   python grabarVideo.py calendario ../dataset_gestos     # 's' = record clip, 'q' = quit
   ```
2. Re-extract landmarks for **all** gestures. Write into `data/` (that is where training and the server read from):
   ```bash
   python data_prep.py --dataset ../dataset_gestos --output data --seq-length 40
   ```
   Gesture IDs are assigned from the dataset folders, so they may shift (e.g. `calendario` lands between `alarma` and `camara`). That is fine because the new map is generated together with the new model.
3. Train (menu option 1) and test live (option 4):
   ```bash
   python train_solid.py
   ```
4. Deploy `trained_models/model_final.pth`, `trained_models/normalization_stats.pth` **and** `data/gestures_map.json` together to EC2 and restart the WebSocket server.

## Training New Models

To train with new gesture data:

1. Create dataset structure:
```
dataset_gestos/
├── gesto1/
│   ├── video1.mp4
│   ├── video2.mp4
├── gesto2/
│   ├── video1.mp4
```

2. Process videos and extract landmarks:
```bash
cd backend/ml-service
python data_prep.py
```

3. Train model:
```bash
python train_solid.py
```

4. Deploy new model:
```bash
cd ../../deployment
./redeploy-model.sh
```

## Testing

Run system verification tests:
```bash
cd backend
python test_system.py
```

This validates:
- Model architecture and forward pass
- Data preparation pipeline
- Inference functionality
- API structure
- Mock request handling

## Performance Optimization

Helen v5.0.2 achieves significant performance improvements over v4:

**Raspberry Pi 5 Metrics:**
- RAM Usage: 90% reduction (Electron → React Web)
- CPU Usage: 50% reduction
- Temperature: 25°C decrease
- Boot Time: <5 seconds to functional state

**Optimization Techniques:**
- MediaPipe.js runs locally (no video transmission)
- Code splitting in Vite build
- WebSocket instead of HTTP polling
- Circular frame buffer to prevent memory leaks

## WebSocket Communication

### Client to Server Events
- `connect` - Establish connection
- `send_frame` - Send 126-feature landmark array
- `disconnect` - Close connection

### Server to Client Events
- `connected` - Connection acknowledged
- `prediction` - Gesture prediction result with confidence
- `buffer_status` - Current buffer fill level (0-40)
- `error` - Error message

### HTTP Endpoints

**Health Check:**
```
GET http://13.58.208.156:5001/health
Response: {"status": "healthy", "model_loaded": true}
```

## Team

Developed by Team Masturgang for XXI Convocatoria 2024-2025 at FCITEC-UABC:
- Almeraz Landeros Isai Magdaleno
- Castro Rojas Gareth Ivann
- Montes Muñoz Jesús Eduardo
- Perez Almaraz Sofia

## License

Academic project developed for UABC. All rights reserved.

## Acknowledgments

- MediaPipe for hand landmark detection
- PyTorch for deep learning framework
- React and Vite for frontend development
- Flask-SocketIO for real-time communication

---

For detailed technical documentation, see `/docs` directory.