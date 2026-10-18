package com.neuronose;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class NeuronoseApplicationTest {

    @Test
    void contextLoads() {
        // Confirms Spring context loads successfully with H2 database configuration
    }
}
