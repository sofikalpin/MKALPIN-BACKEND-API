import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from "react-router-dom";
import { FaHome, FaBuilding, FaUsers, FaCalendarAlt, FaChartBar, FaCog, FaSignOutAlt, FaPlus, FaSearch, FaTh, FaList, FaFilter, FaMapMarkerAlt, FaBed, FaBath, FaRulerCombined, FaTag, FaEdit, FaTrash, FaEye, FaCheck, FaMoneyBillWave, FaTimes, FaDownload, FaSave, FaUser, FaRuler, FaSun, FaCalendarAlt as FaCalendar } from "react-icons/fa";
import OperationSelection from './OperationSelection';
import FilterControls from './FilterControls';
import PropertyList from './PropertyList';
import PropertyForm from './PropertyForm';
import AdminLayout from '../AdminLayout';
import { useAdminData } from '../../../hooks/useAdminData';
import { propertyService } from '../../../services/api';

const PropertyManagement = () => {
  const { properties: apiProperties, isLoading, error } = useAdminData('properties');
  
  const [properties, setProperties] = useState([]);
  const [view, setView] = useState('selection');

  useEffect(() => {
    if (apiProperties && apiProperties.length > 0) {
      setProperties(apiProperties);
    }
  }, [apiProperties]);

  const [filters, setFilters] = useState({
    operationType: '',
    type: '',
    bedrooms: '',
    bathrooms: '',
    priceRange: { min: 0, max: Infinity },
    status: '',
    allowsPets: null,
  });

  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('title');
  const [selectedOperation, setSelectedOperation] = useState('venta');
  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  
  const [newProperty, setNewProperty] = useState({
    title: '',
    description: '',
    address: '',
    neighborhood: '',
    locality: '',
    province: '',
    type: 'Casa',
    operationType: 'venta',
    price: '',
    bedrooms: '',
    bathrooms: '',
    squareMeters: '',
    status: 'disponible',
    images: [],
    lessor: '',
    lessee: '',
    allowsPets: false
  });

  const handleOperationSelection = (operation) => {
    setSelectedOperation(operation);
    setView('list');
  };

  const filterProperties = (properties, filters, searchTerm) => {
    return properties.filter((property) => {
      const matchesOperation = !filters.operationType || property.operationType === filters.operationType;
      const matchesType = !filters.type || property.type === filters.type;
      const matchesBedrooms = !filters.bedrooms || property.bedrooms >= parseInt(filters.bedrooms);
      const matchesBathrooms = !filters.bathrooms || property.bathrooms >= parseInt(filters.bathrooms);
      const matchesPriceRange = property.price >= filters.priceRange.min && property.price <= filters.priceRange.max;
      const matchesStatus = !filters.status || property.status === filters.status;
      const matchesPets = filters.allowsPets === null || property.allowsPets === (filters.allowsPets === 'true');
      const matchesSearch = !searchTerm || 
        property.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.neighborhood.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesOperation && matchesType && matchesBedrooms && matchesBathrooms && matchesPriceRange && matchesStatus && matchesPets && matchesSearch;
    });
  };

  const sortProperties = (properties, sortBy) => {
    const sorted = [...properties];
    switch (sortBy) {
      case 'price':
        return sorted.sort((a, b) => b.price - a.price);
      case 'title':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'date':
        return sorted.sort((a, b) => b.id - a.id);
      default:
        return sorted;
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const filteredAndSortedProperties = sortProperties(filterProperties(properties, filters, searchTerm), sortBy);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleAddProperty = () => {
    setEditingProperty(null);
    setNewProperty({
      _id: undefined,  
      id: undefined,
      title: '',
      description: '',
      address: '',
      neighborhood: '',
      locality: '',
      province: '',
      type: 'Casa',
      operationType: selectedOperation,
      price: '',
      bedrooms: '',
      bathrooms: '',
      squareMeters: '',
      status: 'disponible',
      images: [],
      lessor: '',
      lessee: '',
      allowsPets: false
    });
    setShowForm(true);
  };

  const handleEditProperty = (property) => {
    setEditingProperty(property);
    setNewProperty({
      _id: property.id || property._id,  
      id: property.id || property._id,
      title: property.title,
      description: property.description || '',
      address: property.address,
      neighborhood: property.neighborhood || '',
      locality: property.locality || '',
      province: property.province || '',
      type: property.type,
      operationType: property.operationType,
      price: property.price,
      bedrooms: property.bedrooms || '',
      bathrooms: property.bathrooms || '',
      squareMeters: property.squareMeters || '',
      status: property.status,
      images: property.images || [],
      lessor: property.lessor || '',
      lessee: property.lessee || '',
      allowsPets: property.allowsPets || false
    });
    setShowForm(true);
  };

  const handleDeleteProperty = async (propertyId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta propiedad?')) {
      return;
    }

    try {
      const response = await propertyService.delete(propertyId);
      if (response.status) {
        setProperties(prevProperties => 
          prevProperties.filter(prop => prop.id !== propertyId)
        );
        showNotification('Propiedad eliminada exitosamente');
      } else {
        throw new Error(response.message || 'Error al eliminar la propiedad');
      }
    } catch (error) {
      console.error('Error eliminando propiedad:', error);
      showNotification('Error al eliminar la propiedad', 'error');
    }
  };

  const handleSaveProperty = async (propertyData, imageFiles = []) => {
    setIsSubmitting(true);
    
    try {
      const backendData = {
        titulo: propertyData.title,
        descripcion: propertyData.description,
        direccion: propertyData.address,
        barrio: propertyData.neighborhood,
        localidad: propertyData.locality,
        provincia: propertyData.province,
        tipoPropiedad: propertyData.type,
        transaccionTipo: propertyData.operationType === 'venta' ? 'Venta' : 'Alquiler',
        precio: Number(propertyData.price),
        habitaciones: Number(propertyData.bedrooms) || 0,
        banos: Number(propertyData.bathrooms) || 0,
        superficieM2: Number(propertyData.squareMeters) || 0,
        estado: propertyData.status === 'disponible' ? 'Disponible' : 
                propertyData.status === 'ocupado' ? 'Ocupado' : 'Reservado',
        locador: propertyData.lessor || '',
        locatario: propertyData.lessee || '',
        permitenascotas: propertyData.allowsPets || false,
        activo: true
      };

      let response;
      let createdOrUpdatedId;

      if (editingProperty) {
        response = await propertyService.update(editingProperty.id, backendData);
        if (response.status) {
          createdOrUpdatedId = editingProperty.id;
          setProperties(prevProperties => 
            prevProperties.map(prop => 
              prop.id === editingProperty.id ? { ...prop, ...propertyData } : prop
            )
          );
        }
      } else {
        response = await propertyService.create(backendData);
        if (response.status && response.value) {
          createdOrUpdatedId = response.value._id || response.value.id;
          const newProp = { ...propertyData, id: createdOrUpdatedId };
          setProperties(prevProperties => [...prevProperties, newProp]);
        }
      }

      if (!response.status) {
        throw new Error(response.message || 'Error al guardar la propiedad');
      }

      if (createdOrUpdatedId && imageFiles && imageFiles.length > 0) {
        console.log('Uploading', imageFiles.length, 'images to property:', createdOrUpdatedId);
        try {
          const uploadResp = await propertyService.uploadImages(createdOrUpdatedId, imageFiles);
          if (uploadResp && uploadResp.status) {
            console.log('Images uploaded successfully');
            
            const refreshResp = await propertyService.getById(createdOrUpdatedId);
            if (refreshResp && refreshResp.status) {
              setProperties(prevProperties =>
                prevProperties.map(prop =>
                  prop.id === createdOrUpdatedId ? refreshResp.value : prop
                )
              );
            }
          } else {
            console.warn('Image upload failed:', uploadResp);
          }
        } catch (uploadErr) {
          console.error('Error uploading images:', uploadErr);
          showNotification('Propiedad guardada pero hubo error al subir imágenes', 'error');
        }
      }

      showNotification(editingProperty ? 'Propiedad actualizada exitosamente' : 'Propiedad creada exitosamente');
      setShowForm(false);
      setEditingProperty(null);
      
    } catch (error) {
      console.error('Error guardando propiedad:', error);
      showNotification(`Error al ${editingProperty ? 'actualizar' : 'crear'} la propiedad: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingProperty(null);
    setNewProperty({
      _id: undefined,
      id: undefined,
      title: '',
      description: '',
      address: '',
      neighborhood: '',
      locality: '',
      province: '',
      type: 'Casa',
      operationType: 'venta',
      price: '',
      bedrooms: '',
      bathrooms: '',
      squareMeters: '',
      status: 'disponible',
      images: [],
      lessor: '',
      lessee: '',
      allowsPets: false
    });
  };

  const handleUpdateStatus = (propertyId, newStatus, lessor = '', lessee = '') => {
    const updatedProperty = {
      status: newStatus,
      lessor,
      lessee
    };
    
    setProperties(prevProperties => 
      prevProperties.map(prop => 
        prop.id === propertyId ? { ...prop, ...updatedProperty } : prop
      )
    );
    
    showNotification(`Estado de propiedad actualizado a ${newStatus}`);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Cargando propiedades...</p>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="text-center py-20">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
            <div className="text-red-600 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-red-900 mb-2">Error al cargar propiedades</h3>
            <p className="text-red-700 mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-300"
            >
              Reintentar
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {showForm ? (
        <div>
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {editingProperty ? 'Editar Propiedad' : 'Agregar Nueva Propiedad'}
                </h1>
                <p className="text-gray-600">
                  {editingProperty ? 'Modifica los datos de la propiedad' : 'Completa la información de la nueva propiedad'}
                </p>
              </div>
              <button
                onClick={handleCancelForm}
                className="inline-flex items-center text-gray-600 hover:text-gray-800 font-medium"
              >
                ← Volver a la lista
              </button>
            </div>
          </div>

          <PropertyForm
            property={newProperty}
            editing={!!editingProperty}
            onSave={handleSaveProperty}
            onCancel={handleCancelForm}
            onChange={setNewProperty}
            isSubmitting={isSubmitting}
          />
        </div>
      ) : view === 'selection' ? (
        <div>
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestión de Propiedades</h1>
            <p className="text-gray-600">Selecciona el tipo de operación para gestionar las propiedades</p>
          </div>
          <OperationSelection onSelect={handleOperationSelection} />
        </div>
      ) : view === 'list' ? (
        <div>
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {selectedOperation === 'venta' ? 'Propiedades en Venta' : 'Propiedades en Alquiler'}
                </h1>
                <p className="text-gray-600">
                  Gestiona y administra las propiedades de {selectedOperation}
                </p>
              </div>
              <button
                onClick={() => setView('selection')}
                className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
              >
                ← Cambiar tipo de operación
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por título, dirección o barrio..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="title">Ordenar por Título</option>
                  <option value="price">Ordenar por Precio</option>
                  <option value="date">Ordenar por Fecha</option>
                </select>

                <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-4 py-3 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    <FaTh />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-4 py-3 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    <FaList />
                  </button>
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex items-center px-4 py-3 rounded-lg font-medium transition-colors ${
                    showFilters 
                      ? 'bg-blue-600 text-white' 
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <FaFilter className="mr-2" />
                  Filtros
                </button>

                <button 
                  onClick={handleAddProperty}
                  className="inline-flex items-center bg-green-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  <FaPlus className="mr-2" />
                  Agregar Propiedad
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{filteredAndSortedProperties.length}</div>
                <div className="text-sm text-gray-600">Propiedades mostradas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {filteredAndSortedProperties.filter(p => p.status === 'disponible').length}
                </div>
                <div className="text-sm text-gray-600">Disponibles</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {filteredAndSortedProperties.filter(p => p.status === 'ocupado').length}
                </div>
                <div className="text-sm text-gray-600">Ocupadas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  ${Math.round(filteredAndSortedProperties.reduce((sum, p) => sum + p.price, 0) / filteredAndSortedProperties.length || 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Precio promedio</div>
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="mb-8">
              <FilterControls filters={filters} onFilterChange={handleFilterChange} />
            </div>
          )}

          <PropertyList 
            properties={filteredAndSortedProperties} 
            selectedOperation={selectedOperation}
            viewMode={viewMode}
            onAddNew={handleAddProperty}
            onEdit={handleEditProperty}
            onDelete={handleDeleteProperty}
            onUpdateStatus={handleUpdateStatus}
          />
        </div>
      ) : null}
      
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
          notification.type === 'error' 
            ? 'bg-red-100 border border-red-400 text-red-700' 
            : 'bg-green-100 border border-green-400 text-green-700'
        }`}>
          <div className="flex items-center justify-between">
            <span>{notification.message}</span>
            <button 
              onClick={() => setNotification(null)}
              className="ml-4 text-lg font-semibold"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default PropertyManagement;