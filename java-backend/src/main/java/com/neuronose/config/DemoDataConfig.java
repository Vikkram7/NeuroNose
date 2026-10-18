package com.neuronose.config;

import com.neuronose.service.DemoDataService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(name = "neuronose.demo-mode", havingValue = "true", matchIfMissing = true)
public class DemoDataConfig {

    private static final Logger log = LoggerFactory.getLogger(DemoDataConfig.class);

    @Bean
    public ApplicationRunner demoDataInitializer(DemoDataService demoDataService) {
        return args -> {
            log.info("NeuroNose demo mode enabled. Checking if demo data initialization is required...");
            demoDataService.seedDemoData();
        };
    }
}
