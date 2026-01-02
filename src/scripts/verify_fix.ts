import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';

async function testProductCreation() {
    console.log('--- Testing Product Creation with Invalid teamId ---');
    try {
        const response = await axios.post(`${BASE_URL}/products`, {
            name: 'Test Product',
            description: 'Test Description',
            teamId: 'invalid-team-id'
        });
        console.log('FAIL: Product created with invalid teamId', response.data);
    } catch (error: any) {
        if (error.response) {
            console.log(`SUCCESS: Received ${error.response.status} ${error.response.data.code}: ${error.response.data.message}`);
        } else {
            console.log('ERROR:', error.message);
        }
    }

    console.log('\n--- Testing FAQ Creation with Invalid teamId ---');
    try {
        const response = await axios.post(`${BASE_URL}/faqs`, {
            question: 'Where is the product?',
            answer: 'Right here.',
            teamId: 'invalid-team-id'
        });
        console.log('FAIL: FAQ created with invalid teamId', response.data);
    } catch (error: any) {
        if (error.response) {
            console.log(`SUCCESS: Received ${error.response.status} ${error.response.data.code}: ${error.response.data.message}`);
        } else {
            console.log('ERROR:', error.message);
        }
    }
}

testProductCreation();
