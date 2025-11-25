const express = require('express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const router = express.Router();
const Setting = require('../models/Setting');

router.get('/handlers', (req, res) => {
  try {
    const handlersPath = path.join(__dirname, '../config/handlers.yml');

    if (!fs.existsSync(handlersPath)) {
      return res.status(404).json({
        status: false,
        message: 'Archivo de configuración de handlers no encontrado'
      });
    }

    const handlersConfig = yaml.load(fs.readFileSync(handlersPath, 'utf8'));

    res.json({
      status: true,
      handlers: handlersConfig.handlers,
      metadata: {
        lastModified: fs.statSync(handlersPath).mtime,
        version: '1.0'
      }
    });
  } catch (error) {
    console.error('Error loading handlers config:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor al cargar configuración de handlers'
    });
  }
});

const allowedSections = ['general', 'usuario', 'sistema'];
router.get('/settings/:section', async (req, res) => {
  try {
    const { section } = req.params;
    if (!allowedSections.includes(section)) return res.status(400).json({ status: false, message: 'Sección inválida' });

    const doc = await Setting.findOne({ section });
    if (!doc) return res.json({ status: true, section, data: {} });

    return res.json({ status: true, section: doc.section, data: doc.data });
  } catch (err) {
    console.error('Error fetching settings:', err);
    return res.status(500).json({ status: false, message: 'Error interno al obtener configuración' });
  }
});

router.post('/settings/:section', async (req, res) => {
  try {
    const { section } = req.params;
    const data = req.body;
    if (!allowedSections.includes(section)) return res.status(400).json({ status: false, message: 'Sección inválida' });

    const updated = await Setting.findOneAndUpdate(
      { section },
      { $set: { data } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ status: true, section: updated.section, data: updated.data });
  } catch (err) {
    console.error('Error saving settings:', err);
    return res.status(500).json({ status: false, message: 'Error interno al guardar configuración' });
  }
});

module.exports = router;
