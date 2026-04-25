# Pulse & Pixel: The Media Computing Lab

Welcome to **Pulse & Pixel**, a comprehensive interactive playground designed for CS2108 (Media Computing) concepts. This application bridges the gap between abstract mathematical theory and practical intuition through high-performance visualizations and AI-assisted learning.

## Overview

**Pulse & Pixel** is an educational platform designed to help students visualize and interact with fundamental concepts in digital signal processing and image computing. Developed using modern web technologies, the application provides a hands-on environment for exploring sinusoids, sampling theory, and spatial filtering.

## Core Features

### 1. Sinusoid Playground (Pulse)
Explore the **Superposition Principle** and the **Fourier Transform**.
- **Interactive Control**: Adjust frequency, amplitude, and phase for multiple signals in real-time.
- **Aperiodic Mode**: Visualize "Wave Packets" and see how narrowing a time-domain pulse spreads its frequency spectrum (demonstrating the Uncertainty Principle).
- **Live Spectrum**: Immediate Fourier Transform visualization showing the relationship between time-domain shapes and frequency-domain peaks.

### 2. Sampling & Aliasing Lab
A deep dive into the **Nyquist-Shannon Sampling Theorem**.
- **Audio Integration**: Upload real audio files and perform real-time frequency detection.
- **Nyquist rate Detection**: Automatically identifies the highest frequency components to calculate the required sampling rate.
- **Aliasing Visualization**: Directly observe how sampling below the Nyquist rate ($f_s < 2f$) creates unwanted "alias" frequencies.
- **Audio Output**: Listen to the effects of aliasing and reconstruction filters.

### 3. 2D Image Convolution (Pixel)
Focuses on **Spatial Filtering** in image processing.
- **Interactive Kernels**: Select from standard filters (Blur, Sharpen, Edge) or define custom 3x3 matrices.
- **AI Kernel Generator**: Use generative AI to create complex convolution kernels from natural language descriptions.
- **Real-Time Processing**: Instant per-pixel manipulation using optimized Canvas rendering.

### 4. AI Tutor
A 24/7 teaching assistant integrated directly into the lab.
- **Context-Aware**: Understands which lab you are currently using.
- **Explanations**: Provides mathematical intuition for DSP and image processing concepts.
- **Automation**: Can update lab parameters or generate kernels based on your requests.

## Technology Stack

- **Frontend**: React 18 with Vite
- **Styling**: Tailwind CSS
- **Visualizations**: Recharts & D3.js
- **Audio Engine**: Web Audio API
- **AI**: Google Gemini Pro (via @google/genai)
- **Animations**: Motion (framer-motion)

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/pulse-pixel.git
   cd pulse-pixel
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Optimization Highlights

To ensure a smooth educational experience, we implemented several performance-intensive optimizations:
- **Adaptive Sampling**: Time-domain plots are capped at optimized resolutions to maintain 60fps interaction while preserving wave fidelity.
- **Hardware Acceleration**: Used GPU-accelerated CSS transitions and Canvas rendering for image convolution.
- **Spectral Efficiency**: Optimized frequency-domain calculations using numeric axes and localized peak detection to reduce SVG rendering overhead.

## License

This project is intended for educational purposes as part of the CS2108 Media Computing curriculum.

---
*Created with the goal of making complex mathematics tangible and intuitive.*
