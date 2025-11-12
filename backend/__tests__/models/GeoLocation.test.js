const { GeoLocationService, OfflineService } = require('../../models/GeoLocation');
const { query } = require('../../config/database');
const axios = require('axios');

// Mocks
jest.mock('../../config/database');
jest.mock('axios');
jest.mock('../../models/Usuario');

describe('GeoLocation Models', () => {
  let geoService, offlineService;

  beforeEach(() => {
    geoService = new GeoLocationService();
    offlineService = new OfflineService();
    
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    
    process.env.GOOGLE_MAPS_API_KEY = 'test_api_key';
    process.env.CACHE_VERSION = 'v1';
  });

  describe('GeoLocationService', () => {
    describe('Constructor', () => {
      it('should initialize with Google Maps API key', () => {
        expect(geoService.GOOGLE_MAPS_API_KEY).toBe('test_api_key');
      });

      it('should work without API key', () => {
        delete process.env.GOOGLE_MAPS_API_KEY;
        const service = new GeoLocationService();
        expect(service.GOOGLE_MAPS_API_KEY).toBeUndefined();
      });
    });

    describe('saveUserLocation', () => {
      it('should save user location successfully', async () => {
        const userId = 1;
        const locationData = {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
          address: '123 Main St',
          city: 'New York',
          country: 'USA',
          countryCode: 'US',
          postalCode: '10001'
        };

        query
          .mockResolvedValueOnce({ rows: [{ id: 1, ...locationData }] })
          .mockResolvedValueOnce({ rowCount: 1 });

        const result = await geoService.saveUserLocation(userId, locationData);

        expect(query).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ id: 1, ...locationData });
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('📍 Ubicación guardada')
        );
      });

      it('should save location with minimal data', async () => {
        const userId = 1;
        const locationData = {
          latitude: 40.7128,
          longitude: -74.0060
        };

        query
          .mockResolvedValueOnce({ rows: [{ id: 1, ...locationData }] })
          .mockResolvedValueOnce({ rowCount: 1 });

        await geoService.saveUserLocation(userId, locationData);

        expect(query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO user_locations'),
          expect.arrayContaining([
            userId,
            40.7128,
            -74.0060,
            null, null, null, null, null, null, null,
            'gps'
          ])
        );
      });

      it('should throw error for invalid coordinates', async () => {
        const userId = 1;
        const locationData = {
          latitude: 999,
          longitude: -74.0060
        };

        await expect(
          geoService.saveUserLocation(userId, locationData)
        ).rejects.toThrow('Coordenadas inválidas');
      });

      it('should handle database errors', async () => {
        const userId = 1;
        const locationData = {
          latitude: 40.7128,
          longitude: -74.0060
        };

        query.mockRejectedValue(new Error('DB error'));

        await expect(
          geoService.saveUserLocation(userId, locationData)
        ).rejects.toThrow('DB error');

        expect(console.error).toHaveBeenCalledWith(
          'Error guardando ubicación:',
          expect.any(Error)
        );
      });

      it('should use custom source parameter', async () => {
        const userId = 1;
        const locationData = {
          latitude: 40.7128,
          longitude: -74.0060,
          source: 'ip'
        };

        query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rowCount: 1 });

        await geoService.saveUserLocation(userId, locationData);

        expect(query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['ip'])
        );
      });
    });

    describe('getLocationByIP', () => {
      it('should get location by IP successfully', async () => {
        const ipAddress = '8.8.8.8';
        const mockResponse = {
          data: {
            latitude: 37.7749,
            longitude: -122.4194,
            city: 'San Francisco',
            country_name: 'United States',
            country_code: 'US',
            postal: '94102'
          }
        };

        axios.get.mockResolvedValue(mockResponse);

        const result = await geoService.getLocationByIP(ipAddress);

        expect(result).toEqual({
          latitude: 37.7749,
          longitude: -122.4194,
          city: 'San Francisco',
          country: 'United States',
          countryCode: 'US',
          postalCode: '94102',
          source: 'ip'
        });

        expect(axios.get).toHaveBeenCalledWith(
          `https://ipapi.co/${ipAddress}/json/`,
          { timeout: 5000 }
        );
      });

      it('should reject local IP addresses', async () => {
        const result = await geoService.getLocationByIP('127.0.0.1');

        expect(result).toEqual({
          latitude: 0,
          longitude: 0,
          city: 'Unknown',
          country: 'Unknown',
          countryCode: 'XX',
          source: 'ip_fallback'
        });

        expect(axios.get).not.toHaveBeenCalled();
      });

      it('should reject ::1 (IPv6 localhost)', async () => {
        const result = await geoService.getLocationByIP('::1');

        expect(result.source).toBe('ip_fallback');
      });

      it('should handle API errors gracefully', async () => {
        axios.get.mockRejectedValue(new Error('API error'));

        const result = await geoService.getLocationByIP('8.8.8.8');

        expect(result.source).toBe('ip_fallback');
        expect(console.error).toHaveBeenCalled();
      });

      it('should handle API error response', async () => {
        axios.get.mockResolvedValue({
          data: {
            error: true,
            reason: 'Invalid IP'
          }
        });

        const result = await geoService.getLocationByIP('invalid-ip');

        expect(result.source).toBe('ip_fallback');
      });

      it('should reject unknown IP', async () => {
        const result = await geoService.getLocationByIP('unknown');
        expect(result.source).toBe('ip_fallback');
      });
    });

    describe('reverseGeocode', () => {
      it('should reverse geocode coordinates successfully', async () => {
        const mockResponse = {
          data: {
            status: 'OK',
            results: [{
              formatted_address: '123 Main St, San Francisco, CA 94102',
              address_components: [
                { types: ['locality'], long_name: 'San Francisco', short_name: 'SF' },
                { types: ['country'], long_name: 'United States', short_name: 'US' },
                { types: ['postal_code'], long_name: '94102', short_name: '94102' }
              ]
            }]
          }
        };

        axios.get.mockResolvedValue(mockResponse);

        const result = await geoService.reverseGeocode(37.7749, -122.4194);

        expect(result).toEqual({
          address: '123 Main St, San Francisco, CA 94102',
          city: 'San Francisco',
          country: 'United States',
          countryCode: 'US',
          postalCode: '94102'
        });
      });

      it('should return null if API key not configured', async () => {
        delete geoService.GOOGLE_MAPS_API_KEY;

        const result = await geoService.reverseGeocode(37.7749, -122.4194);

        expect(result).toBeNull();
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Google Maps API key no configurada')
        );
      });

      it('should handle API errors', async () => {
        axios.get.mockRejectedValue(new Error('API error'));

        const result = await geoService.reverseGeocode(37.7749, -122.4194);

        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalled();
      });

      it('should handle non-OK status', async () => {
        axios.get.mockResolvedValue({
          data: { status: 'ZERO_RESULTS', results: [] }
        });

        const result = await geoService.reverseGeocode(0, 0);

        expect(result).toBeNull();
      });

      it('should fallback to administrative_area_level_2 for city', async () => {
        const mockResponse = {
          data: {
            status: 'OK',
            results: [{
              formatted_address: 'Test Address',
              address_components: [
                { types: ['administrative_area_level_2'], long_name: 'County', short_name: 'CO' },
                { types: ['country'], long_name: 'USA', short_name: 'US' }
              ]
            }]
          }
        };

        axios.get.mockResolvedValue(mockResponse);

        const result = await geoService.reverseGeocode(37.7749, -122.4194);

        expect(result.city).toBe('County');
      });
    });

    describe('getNearbyUsers', () => {
      it('should get nearby users successfully', async () => {
        query
          .mockResolvedValueOnce({
            rows: [{ current_latitude: 40.7128, current_longitude: -74.0060 }]
          })
          .mockResolvedValueOnce({
            rows: [
              { id: 2, nombre: 'User 2', distance_km: 2.5 },
              { id: 3, nombre: 'User 3', distance_km: 5.0 }
            ]
          });

        const result = await geoService.getNearbyUsers(1, 10, 20);

        expect(result).toHaveLength(2);
        expect(result[0].distance_km).toBe(2.5);
        expect(query).toHaveBeenCalledTimes(2);
      });

      it('should throw error if user has no location', async () => {
        query.mockResolvedValue({ rows: [] });

        await expect(
          geoService.getNearbyUsers(1)
        ).rejects.toThrow('Usuario sin ubicación registrada');
      });

      it('should throw error if user location is null', async () => {
        query.mockResolvedValue({
          rows: [{ current_latitude: null, current_longitude: null }]
        });

        await expect(
          geoService.getNearbyUsers(1)
        ).rejects.toThrow('Usuario sin ubicación registrada');
      });

      it('should use custom radius and limit', async () => {
        query
          .mockResolvedValueOnce({
            rows: [{ current_latitude: 40.7128, current_longitude: -74.0060 }]
          })
          .mockResolvedValueOnce({ rows: [] });

        await geoService.getNearbyUsers(1, 50, 100);

        expect(query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([1, 40.7128, -74.0060, 50, 100])
        );
      });

      it('should handle database errors', async () => {
        query.mockRejectedValue(new Error('DB error'));

        await expect(
          geoService.getNearbyUsers(1)
        ).rejects.toThrow('DB error');

        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('getLocationHistory', () => {
      it('should get location history successfully', async () => {
        const mockHistory = [
          { id: 1, latitude: 40.7128, longitude: -74.0060 },
          { id: 2, latitude: 40.7589, longitude: -73.9851 }
        ];

        query.mockResolvedValue({ rows: mockHistory });

        const result = await geoService.getLocationHistory(1, 50);

        expect(result).toEqual(mockHistory);
        expect(query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM user_locations'),
          [1, 50]
        );
      });

      it('should use default limit', async () => {
        query.mockResolvedValue({ rows: [] });

        await geoService.getLocationHistory(1);

        expect(query).toHaveBeenCalledWith(
          expect.any(String),
          [1, 50]
        );
      });

      it('should handle database errors', async () => {
        query.mockRejectedValue(new Error('DB error'));

        await expect(
          geoService.getLocationHistory(1)
        ).rejects.toThrow('DB error');
      });
    });

    describe('isValidCoordinates', () => {
      it('should validate correct coordinates', () => {
        expect(geoService.isValidCoordinates(40.7128, -74.0060)).toBe(true);
        expect(geoService.isValidCoordinates(0, 0)).toBe(true);
        expect(geoService.isValidCoordinates(90, 180)).toBe(true);
        expect(geoService.isValidCoordinates(-90, -180)).toBe(true);
      });

      it('should reject invalid latitude', () => {
        expect(geoService.isValidCoordinates(91, 0)).toBe(false);
        expect(geoService.isValidCoordinates(-91, 0)).toBe(false);
      });

      it('should reject invalid longitude', () => {
        expect(geoService.isValidCoordinates(0, 181)).toBe(false);
        expect(geoService.isValidCoordinates(0, -181)).toBe(false);
      });

      it('should reject NaN values', () => {
        expect(geoService.isValidCoordinates('invalid', 0)).toBe(false);
        expect(geoService.isValidCoordinates(0, 'invalid')).toBe(false);
      });

      it('should handle string numbers', () => {
        expect(geoService.isValidCoordinates('40.7128', '-74.0060')).toBe(true);
      });
    });

    describe('extractAddressComponent', () => {
      it('should extract long_name by default', () => {
        const components = [
          { types: ['locality'], long_name: 'San Francisco', short_name: 'SF' }
        ];

        const result = geoService.extractAddressComponent(components, 'locality');
        expect(result).toBe('San Francisco');
      });

      it('should extract short_name when specified', () => {
        const components = [
          { types: ['country'], long_name: 'United States', short_name: 'US' }
        ];

        const result = geoService.extractAddressComponent(components, 'country', 'short_name');
        expect(result).toBe('US');
      });

      it('should return null if component not found', () => {
        const components = [
          { types: ['locality'], long_name: 'San Francisco' }
        ];

        const result = geoService.extractAddressComponent(components, 'country');
        expect(result).toBeNull();
      });

      it('should handle empty components array', () => {
        const result = geoService.extractAddressComponent([], 'locality');
        expect(result).toBeNull();
      });
    });
  });

  describe('OfflineService', () => {
    describe('Constructor', () => {
      it('should initialize with cache version', () => {
        expect(offlineService.CACHE_VERSION).toBe('v1');
      });

      it('should use default cache version', () => {
        delete process.env.CACHE_VERSION;
        const service = new OfflineService();
        expect(service.CACHE_VERSION).toBe('v1');
      });
    });

    describe('getOfflineData', () => {
      it('should get offline data successfully', async () => {
        query
          .mockResolvedValueOnce({
            rows: [{ id: 1, nombre: 'Test User', email: 'test@test.com' }]
          })
          .mockResolvedValueOnce({
            rows: [
              { id: 1, nombre: 'User 1' },
              { id: 2, nombre: 'User 2' }
            ]
          })
          .mockResolvedValueOnce({
            rows: [
              { rol: 'admin', cantidad: 5 },
              { rol: 'lector', cantidad: 10 }
            ]
          });

        const result = await offlineService.getOfflineData(1);

        expect(result).toHaveProperty('user');
        expect(result).toHaveProperty('usuarios');
        expect(result).toHaveProperty('estadisticas');
        expect(result).toHaveProperty('cached_at');
        expect(result.usuarios).toHaveLength(2);
        expect(result.estadisticas).toHaveLength(2);
      });

      it('should handle database errors', async () => {
        query.mockRejectedValue(new Error('DB error'));

        await expect(
          offlineService.getOfflineData(1)
        ).rejects.toThrow('DB error');
      });
    });

    describe('storePendingAction', () => {
      it('should store pending action successfully', async () => {
        query.mockResolvedValue({ rowCount: 1 });

        const result = await offlineService.storePendingAction(
          1,
          'create_user',
          { nombre: 'Test', email: 'test@test.com' }
        );

        expect(result).toEqual({ success: true });
        expect(query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO pending_sync_actions'),
          expect.arrayContaining([1, 'create_user', expect.any(String)])
        );
      });

      it('should serialize data to JSON', async () => {
        query.mockResolvedValue({ rowCount: 1 });

        await offlineService.storePendingAction(1, 'update_user', { id: 1, nombre: 'Updated' });

        const callArgs = query.mock.calls[0][1];
        expect(typeof callArgs[2]).toBe('string');
        expect(JSON.parse(callArgs[2])).toEqual({ id: 1, nombre: 'Updated' });
      });

      it('should handle database errors', async () => {
        query.mockRejectedValue(new Error('DB error'));

        await expect(
          offlineService.storePendingAction(1, 'create_user', {})
        ).rejects.toThrow('DB error');
      });
    });

    describe('processPendingActions', () => {
      it('should process pending actions successfully', async () => {
        const mockActions = [
          {
            id: 1,
            action_type: 'update_location',
            action_data: JSON.stringify({ latitude: 40.7128, longitude: -74.0060 }),
            user_id: 1
          }
        ];

        query
          .mockResolvedValueOnce({ rows: mockActions })
          .mockResolvedValueOnce({ rowCount: 1 });

        offlineService.processAction = jest.fn().mockResolvedValue(true);

        const result = await offlineService.processPendingActions(1);

        expect(result.processed).toContain(1);
        expect(result.failed).toHaveLength(0);
      });

      it('should handle failed actions', async () => {
        const mockActions = [
          {
            id: 1,
            action_type: 'invalid_action',
            action_data: '{}',
            user_id: 1
          }
        ];

        query
          .mockResolvedValueOnce({ rows: mockActions })
          .mockResolvedValueOnce({ rowCount: 1 });

        offlineService.processAction = jest.fn().mockRejectedValue(new Error('Processing failed'));

        const result = await offlineService.processPendingActions(1);

        expect(result.failed).toHaveLength(1);
        expect(result.failed[0]).toHaveProperty('error', 'Processing failed');
      });

      it('should handle database errors', async () => {
        query.mockRejectedValue(new Error('DB error'));

        await expect(
          offlineService.processPendingActions(1)
        ).rejects.toThrow('DB error');
      });
    });

    describe('processAction', () => {
      it('should handle update_location action', async () => {
        const action = {
          action_type: 'update_location',
          action_data: JSON.stringify({ latitude: 40.7128, longitude: -74.0060 }),
          user_id: 1
        };

        const mockGeoService = {
          saveUserLocation: jest.fn().mockResolvedValue(true)
        };

        GeoLocationService.prototype.saveUserLocation = mockGeoService.saveUserLocation;

        await offlineService.processAction(action);

        expect(mockGeoService.saveUserLocation).toHaveBeenCalled();
      });

      it('should throw error for unknown action type', async () => {
        const action = {
          action_type: 'unknown_action',
          action_data: '{}'
        };

        await expect(
          offlineService.processAction(action)
        ).rejects.toThrow('Acción no reconocida: unknown_action');
      });
    });
  });
});